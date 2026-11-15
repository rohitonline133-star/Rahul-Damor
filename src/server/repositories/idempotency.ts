import type { PoolClient } from 'pg';
import { createHash } from 'node:crypto';

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const KEY = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_RESPONSE_BYTES = 64 * 1024;

export type IdempotencyClaim =
  | { kind: 'claimed' }
  | { kind: 'replay'; response: unknown }
  | { kind: 'in_progress' };

/** SHA-256 of the canonical request bytes supplied by the route layer. */
export function hashIdempotencyRequest(canonicalRequest: string): string {
  if (typeof canonicalRequest !== 'string' || canonicalRequest.length === 0 ||
      Buffer.byteLength(canonicalRequest, 'utf8') > 256 * 1024) {
    throw new Error('Invalid idempotency request representation.');
  }
  return createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');
}

/**
 * Claim a key in the caller's transaction before performing the mutation.
 * Keep the row and business mutation in the same transaction. If an existing
 * unexpired key has a different request hash, reject it rather than replaying
 * another command's response. Expired keys may be safely reused for a new
 * request, regardless of the old request hash.
 */
export async function claimIdempotencyKey(
  client: PoolClient,
  input: { scope: string; key: string; requestHash: string; ttlMs?: number },
): Promise<IdempotencyClaim> {
  if (!input || !TOKEN.test(input.scope) || !KEY.test(input.key) ||
      !/^[a-f0-9]{64}$/.test(input.requestHash)) {
    throw new Error('Invalid idempotency key input.');
  }
  const ttlMs = input.ttlMs ?? 24 * 60 * 60 * 1000;
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 60_000 || ttlMs > 7 * 24 * 60 * 60 * 1000) {
    throw new Error('Invalid idempotency retention period.');
  }

  const inserted = await client.query<{ idempotency_key: string }>(`
    INSERT INTO idempotency_keys (scope, idempotency_key, request_hash, expires_at)
    VALUES ($1, $2, $3, now() + ($4 * interval '1 millisecond'))
    ON CONFLICT (scope, idempotency_key) DO NOTHING
    RETURNING idempotency_key
  `, [input.scope, input.key, input.requestHash, ttlMs]);

  if (inserted.rowCount === 1) return { kind: 'claimed' };

  const existing = await client.query<{ request_hash: string; response: unknown; expired: boolean }>(`
    SELECT request_hash, response, (expires_at <= now()) AS expired
    FROM idempotency_keys
    WHERE scope = $1 AND idempotency_key = $2
    FOR UPDATE
  `, [input.scope, input.key]);
  const row = existing.rows[0];
  if (!row) throw new Error('Idempotency claim disappeared; retry the transaction.');

  // Check expiry before comparing request hashes: after the retention window,
  // the same client key represents a fresh operation and may have a new body.
  // The row lock serializes this replacement with concurrent retries.
  if (row.expired) {
    await client.query(`
      UPDATE idempotency_keys
      SET response = NULL, request_hash = $3,
          expires_at = now() + ($4 * interval '1 millisecond')
      WHERE scope = $1 AND idempotency_key = $2
    `, [input.scope, input.key, input.requestHash, ttlMs]);
    return { kind: 'claimed' };
  }
  if (row.request_hash !== input.requestHash) {
    throw new Error('Idempotency key was already used for a different request.');
  }
  if (row.response === null) return { kind: 'in_progress' };
  return { kind: 'replay', response: row.response };
}

/** Store the response before committing the same transaction as the mutation. */
export async function completeIdempotencyKey(
  client: PoolClient,
  input: { scope: string; key: string; requestHash: string; response: unknown },
): Promise<void> {
  if (!input || !TOKEN.test(input.scope) || !KEY.test(input.key) ||
      !/^[a-f0-9]{64}$/.test(input.requestHash)) {
    throw new Error('Invalid idempotency completion input.');
  }
  // JSON null is reserved as the "claimed but not completed" sentinel.
  // Reject it so a completed null response cannot be mistaken for in-progress.
  if (input.response === null || input.response === undefined) {
    throw new Error('Idempotency response must be a non-null JSON value.');
  }
  const serialized = JSON.stringify(input.response);
  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('Idempotency response exceeds the supported JSON size.');
  }
  const result = await client.query(`
    UPDATE idempotency_keys
    SET response = $4::jsonb
    WHERE scope = $1 AND idempotency_key = $2
      AND request_hash = $3 AND response IS NULL AND expires_at > now()
  `, [input.scope, input.key, input.requestHash, serialized]);
  if (result.rowCount !== 1) throw new Error('Idempotency claim is missing, expired, or already completed.');
}

/** Bounded cleanup; safe to run repeatedly from a maintenance worker. */
export async function deleteExpiredIdempotencyKeys(
  client: PoolClient,
  batchSize = 500,
): Promise<number> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error('Invalid idempotency cleanup batch size.');
  }
  const result = await client.query(`
    WITH expired AS (
      SELECT scope, idempotency_key
      FROM idempotency_keys
      WHERE expires_at <= now()
      ORDER BY expires_at
      FOR UPDATE SKIP LOCKED
      LIMIT $1
    )
    DELETE FROM idempotency_keys target
    USING expired
    WHERE target.scope = expired.scope
      AND target.idempotency_key = expired.idempotency_key
  `, [batchSize]);
  return result.rowCount ?? 0;
}
