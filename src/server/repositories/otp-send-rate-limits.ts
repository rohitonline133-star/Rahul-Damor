import { createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';

export type OtpQuotaScope = 'phone' | 'ip' | 'device';
export type OtpQuotaInput = { phone: string; ip: string; deviceId: string };
export type OtpQuotaResult =
  | { allowed: true }
  | { allowed: false; scope: OtpQuotaScope; retryAfterSeconds: number };

const WINDOW_MS = 30 * 60 * 1000;
const BLOCK_MS = 30 * 60 * 1000;
const LIMITS: Record<OtpQuotaScope, number> = { phone: 3, ip: 10, device: 5 };

function digest(scope: OtpQuotaScope, value: string, secret: string): string {
  return createHmac('sha256', secret).update(scope + ':' + value).digest('hex');
}

/** Caller must hold a PostgreSQL transaction; advisory locks serialize quota updates across instances. */
export async function consumeOtpSendQuota(
  client: PoolClient,
  input: OtpQuotaInput,
  secret: string,
  now = new Date(),
): Promise<OtpQuotaResult> {
  if (!input || typeof input.phone !== 'string' || !/^\+[1-9][0-9]{7,14}$/.test(input.phone) ||
      typeof input.ip !== 'string' || input.ip.length < 1 || input.ip.length > 64 ||
      typeof input.deviceId !== 'string' || input.deviceId.length < 1 || input.deviceId.length > 256 ||
      typeof secret !== 'string' || secret.length < 32 || !(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('Invalid OTP quota input.');
  }

  const values: Record<OtpQuotaScope, string> = { phone: input.phone, ip: input.ip, device: input.deviceId };
  const keys = (Object.keys(LIMITS) as OtpQuotaScope[])
    .map((scope) => ({ scope, keyHash: digest(scope, values[scope], secret) }))
    .sort((a, b) => a.scope.localeCompare(b.scope));

  for (const key of keys) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key.scope + ':' + key.keyHash]);
  }

  const states: Array<{ scope: OtpQuotaScope; keyHash: string; count: number; windowStartedAt: Date; blockedUntil: Date | null }> = [];
  for (const key of keys) {
    const result = await client.query<{
      request_count: number; window_started_at: Date; blocked_until: Date | null;
    }>('SELECT request_count, window_started_at, blocked_until FROM otp_send_rate_limits WHERE scope = $1 AND key_hash = $2 FOR UPDATE',
    [key.scope, key.keyHash]);
    const row = result.rows[0];
    states.push({
      ...key,
      count: row ? Number(row.request_count) : 0,
      windowStartedAt: row ? new Date(row.window_started_at) : now,
      blockedUntil: row && row.blocked_until ? new Date(row.blocked_until) : null,
    });
  }

  for (const state of states) {
    if (state.blockedUntil && state.blockedUntil.getTime() > now.getTime()) {
      return { allowed: false, scope: state.scope, retryAfterSeconds: Math.ceil((state.blockedUntil.getTime() - now.getTime()) / 1000) };
    }
    const expired = now.getTime() - state.windowStartedAt.getTime() >= WINDOW_MS;
    if ((expired ? 0 : state.count) >= LIMITS[state.scope]) {
      await client.query('UPDATE otp_send_rate_limits SET blocked_until = $3, updated_at = $4 WHERE scope = $1 AND key_hash = $2',
        [state.scope, state.keyHash, new Date(now.getTime() + BLOCK_MS), now]);
      return { allowed: false, scope: state.scope, retryAfterSeconds: Math.ceil(BLOCK_MS / 1000) };
    }
  }

  for (const state of states) {
    const expired = now.getTime() - state.windowStartedAt.getTime() >= WINDOW_MS;
    await client.query(
      'INSERT INTO otp_send_rate_limits (scope, key_hash, window_started_at, request_count, blocked_until, updated_at) ' +
      'VALUES ($1, $2, $3, 1, NULL, $3) ON CONFLICT (scope, key_hash) DO UPDATE SET ' +
      'window_started_at = CASE WHEN $4 THEN EXCLUDED.window_started_at ELSE otp_send_rate_limits.window_started_at END, ' +
      'request_count = CASE WHEN $4 THEN 1 ELSE otp_send_rate_limits.request_count + 1 END, ' +
      'blocked_until = NULL, updated_at = EXCLUDED.updated_at',
      [state.scope, state.keyHash, now, expired]);
  }
  return { allowed: true };
}
