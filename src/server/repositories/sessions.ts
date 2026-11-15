import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

const TOKEN_PATTERN = /^gb_tok_[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_METADATA_BYTES = 4096;

export type SessionMetadata = {
  deviceName: string;
  platform: string;
  ip?: string | null;
  userAgent?: string | null;
};

export type IssuedSession = {
  id: string;
  token: string;
  userId: string;
  deviceName: string;
  platform: string;
  createdAt: number;
  expiresAt: number;
};

export type StoredSession = {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  device_metadata: SessionMetadata;
};

function digestToken(token: string): string {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new Error('Invalid session token.');
  }
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function safeMetadata(metadata: SessionMetadata): SessionMetadata {
  if (!metadata || typeof metadata.deviceName !== 'string' ||
      metadata.deviceName.length < 1 || metadata.deviceName.length > 120 ||
      typeof metadata.platform !== 'string' || metadata.platform.length < 1 ||
      metadata.platform.length > 32) {
    throw new Error('Invalid session metadata.');
  }
  const result: SessionMetadata = {
    deviceName: metadata.deviceName,
    platform: metadata.platform,
    ip: typeof metadata.ip === 'string' ? metadata.ip.slice(0, 64) : null,
    userAgent: typeof metadata.userAgent === 'string' ? metadata.userAgent.slice(0, 512) : null,
  };
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > MAX_METADATA_BYTES) {
    throw new Error('Session metadata exceeds the allowed size.');
  }
  return result;
}

/** Store only a one-way token digest. Caller owns transaction boundaries. */
export async function createPersistentSession(
  client: PoolClient,
  userId: string,
  metadata: SessionMetadata,
  lifetimeMs = 30 * 24 * 60 * 60 * 1000,
): Promise<IssuedSession> {
  if (!ID_PATTERN.test(userId)) throw new Error('Invalid session user ID.');
  if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 60_000 ||
      lifetimeMs > 90 * 24 * 60 * 60 * 1000) {
    throw new Error('Invalid session lifetime.');
  }
  const safe = safeMetadata(metadata);
  const token = 'gb_tok_' + randomBytes(32).toString('hex');
  const id = 'sess_' + randomUUID().replace(/-/g, '');
  const createdAt = Date.now();
  const expiresAt = createdAt + lifetimeMs;
  await client.query(`
    INSERT INTO user_sessions (id, user_id, token_hash, expires_at, device_metadata)
    VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5::jsonb)
  `, [id, userId, digestToken(token), expiresAt, JSON.stringify(safe)]);
  return { id, token, userId, ...safe, createdAt, expiresAt };
}

export async function findPersistentSession(
  client: PoolClient,
  token: string,
): Promise<StoredSession | null> {
  const result = await client.query<StoredSession>(`
    SELECT id, user_id, expires_at, revoked_at, created_at, device_metadata
    FROM user_sessions
    WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
    LIMIT 1
  `, [digestToken(token)]);
  return result.rows[0] ?? null;
}

export async function revokePersistentSession(
  client: PoolClient,
  token: string,
): Promise<boolean> {
  const result = await client.query(`
    UPDATE user_sessions SET revoked_at = now()
    WHERE token_hash = $1 AND revoked_at IS NULL
  `, [digestToken(token)]);
  return (result.rowCount ?? 0) === 1;
}

export async function revokeAllPersistentSessions(
  client: PoolClient,
  userId: string,
): Promise<number> {
  if (!ID_PATTERN.test(userId)) throw new Error('Invalid session user ID.');
  const result = await client.query(`
    UPDATE user_sessions SET revoked_at = now()
    WHERE user_id = $1 AND revoked_at IS NULL
  `, [userId]);
  return result.rowCount ?? 0;
}

/** Lists active sessions for a single account; bearer tokens are never returned. */
export async function listPersistentSessions(
  client: PoolClient,
  userId: string,
): Promise<StoredSession[]> {
  if (!ID_PATTERN.test(userId)) throw new Error('Invalid session user ID.');
  const result = await client.query<StoredSession>(`
    SELECT id, user_id, expires_at, revoked_at, created_at, device_metadata
    FROM user_sessions
    WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC, id DESC
  `, [userId]);
  return result.rows;
}

/** Revokes a session only when it belongs to the authenticated account. */
export async function revokePersistentSessionById(
  client: PoolClient,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  if (!ID_PATTERN.test(userId) || !/^sess_[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
    throw new Error('Invalid session identifier.');
  }
  const result = await client.query(`
    UPDATE user_sessions SET revoked_at = now()
    WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
  `, [sessionId, userId]);
  return (result.rowCount ?? 0) === 1;
}
