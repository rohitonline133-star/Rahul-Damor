import { createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';

export type ApiQuotaScope = 'ip' | 'route' | 'auth' | 'session';
export type ApiQuotaInput = { scope: ApiQuotaScope; value: string; maxRequests: number };
export type ApiQuotaResult =
  | { allowed: true }
  | { allowed: false; scope: ApiQuotaScope; retryAfterSeconds: number };

const WINDOW_MS = 60_000;
const BLOCK_MS = 60_000;

function digest(scope: ApiQuotaScope, value: string, secret: string): string {
  return createHmac('sha256', secret).update(scope + ':' + value).digest('hex');
}

/** Atomic, shared fixed-window quotas. Caller must hold a PostgreSQL transaction. */
export async function consumeApiRequestQuota(
  client: PoolClient,
  quotas: ApiQuotaInput[],
  secret: string,
  now = new Date(),
): Promise<ApiQuotaResult> {
  if (!Array.isArray(quotas) || quotas.length < 1 || quotas.length > 8 ||
      typeof secret !== 'string' || secret.length < 32 ||
      !(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('Invalid API rate-limit input.');
  }
  const seen = new Set<string>();
  for (const quota of quotas) {
    if (!quota || !['ip', 'route', 'auth', 'session'].includes(quota.scope) ||
        typeof quota.value !== 'string' || quota.value.length < 1 || quota.value.length > 512 ||
        !Number.isInteger(quota.maxRequests) || quota.maxRequests < 1 || quota.maxRequests > 100_000) {
      throw new Error('Invalid API rate-limit bucket.');
    }
    if (seen.has(quota.scope)) throw new Error('Duplicate API rate-limit scope.');
    seen.add(quota.scope);
  }

  const keys = quotas.map((quota) => ({
    scope: quota.scope,
    keyHash: digest(quota.scope, quota.value, secret),
    maxRequests: quota.maxRequests,
  })).sort((a, b) => a.scope.localeCompare(b.scope));

  // Deterministic lock order prevents deadlocks when a request consumes multiple buckets.
  for (const key of keys) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key.scope + ':' + key.keyHash]);
  }

  const states: Array<{
    scope: ApiQuotaScope; keyHash: string; maxRequests: number;
    count: number; windowStartedAt: Date; blockedUntil: Date | null;
  }> = [];
  for (const key of keys) {
    const result = await client.query<{
      request_count: number; window_started_at: Date; blocked_until: Date | null;
    }>('SELECT request_count, window_started_at, blocked_until FROM api_request_rate_limits WHERE scope = $1 AND key_hash = $2 FOR UPDATE',
    [key.scope, key.keyHash]);
    const row = result.rows[0];
    states.push({
      ...key,
      count: row ? Number(row.request_count) : 0,
      windowStartedAt: row ? new Date(row.window_started_at) : now,
      blockedUntil: row?.blocked_until ? new Date(row.blocked_until) : null,
    });
  }

  for (const state of states) {
    if (state.blockedUntil && state.blockedUntil.getTime() > now.getTime()) {
      return { allowed: false, scope: state.scope, retryAfterSeconds: Math.ceil((state.blockedUntil.getTime() - now.getTime()) / 1000) };
    }
    const expired = now.getTime() - state.windowStartedAt.getTime() >= WINDOW_MS;
    if ((expired ? 0 : state.count) >= state.maxRequests) {
      const blockedUntil = new Date(now.getTime() + BLOCK_MS);
      await client.query('UPDATE api_request_rate_limits SET blocked_until = $3, updated_at = $4 WHERE scope = $1 AND key_hash = $2',
        [state.scope, state.keyHash, blockedUntil, now]);
      return { allowed: false, scope: state.scope, retryAfterSeconds: Math.ceil(BLOCK_MS / 1000) };
    }
  }

  for (const state of states) {
    const expired = now.getTime() - state.windowStartedAt.getTime() >= WINDOW_MS;
    await client.query(
      'INSERT INTO api_request_rate_limits (scope, key_hash, window_started_at, request_count, blocked_until, updated_at) ' +
      'VALUES ($1, $2, $3, 1, NULL, $3) ON CONFLICT (scope, key_hash) DO UPDATE SET ' +
      'window_started_at = CASE WHEN $4 THEN EXCLUDED.window_started_at ELSE api_request_rate_limits.window_started_at END, ' +
      'request_count = CASE WHEN $4 THEN 1 ELSE api_request_rate_limits.request_count + 1 END, ' +
      'blocked_until = NULL, updated_at = EXCLUDED.updated_at',
      [state.scope, state.keyHash, now, expired]);
  }
  return { allowed: true };
}
