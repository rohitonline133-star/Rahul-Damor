import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';

export type PhoneOtpPurpose = 'register' | 'login' | 'authenticate';
export type NewPhoneChallenge = {
  phone: string;
  purpose: PhoneOtpPurpose;
  requestIp?: string | null;
  deviceId?: string | null;
  ttlMs?: number;
  cooldownMs?: number;
  maxAttempts?: number;
};
export type IssuedPhoneChallenge = {
  id: string;
  code: string;
  expiresAt: Date;
  cooldownUntil: Date;
};
export type VerifiedPhoneChallenge = {
  challengeId: string;
  phone: string;
  purpose: PhoneOtpPurpose;
  verificationToken: string;
  verificationExpiresAt: Date;
};

const E164 = /^\+[1-9][0-9]{7,14}$/;
const CODE = /^[0-9]{6}$/;
const PURPOSES = new Set<PhoneOtpPurpose>(['register', 'login', 'authenticate']);
const MAX_TTL_MS = 15 * 60 * 1000;
const MAX_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function digestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/** Caller must hold a transaction. Returns the OTP only for delivery; only its HMAC is stored. */
export async function createPhoneVerificationChallenge(
  client: PoolClient,
  input: NewPhoneChallenge,
): Promise<IssuedPhoneChallenge> {
  if (!input || !E164.test(input.phone) || !PURPOSES.has(input.purpose)) {
    throw new Error('Invalid phone verification challenge.');
  }
  const ttlMs = input.ttlMs ?? 10 * 60 * 1000;
  const cooldownMs = input.cooldownMs ?? 45 * 1000;
  const maxAttempts = input.maxAttempts ?? 5;
  if (!Number.isInteger(ttlMs) || ttlMs < 30_000 || ttlMs > MAX_TTL_MS ||
      !Number.isInteger(cooldownMs) || cooldownMs < 0 || cooldownMs > MAX_COOLDOWN_MS ||
      !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) {
    throw new Error('Invalid phone verification challenge limits.');
  }
  if (input.requestIp != null && !validText(input.requestIp, 64)) throw new Error('Invalid request IP metadata.');
  if (input.deviceId != null && !validText(input.deviceId, 128)) throw new Error('Invalid device metadata.');

  const now = Date.now();
  const code = randomInt(100000, 1000000).toString();
  const salt = randomBytes(16).toString('hex');
  const codeHash = createHmac('sha256', salt).update(code).digest('hex');
  const id = 'pv_' + randomBytes(16).toString('hex');
  const expiresAt = new Date(now + ttlMs);
  const cooldownUntil = new Date(now + cooldownMs);

  await client.query(`
    UPDATE verification_challenges
    SET superseded_at = now()
    WHERE phone = $1 AND purpose = $2
      AND consumed_at IS NULL AND superseded_at IS NULL
  `, [input.phone, input.purpose]);
  await client.query(`
    INSERT INTO verification_challenges (
      id, phone, purpose, code_hash, code_salt, max_attempts,
      expires_at, cooldown_until, request_ip, device_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `, [id, input.phone, input.purpose, codeHash, salt, maxAttempts,
    expiresAt, cooldownUntil, input.requestIp ?? null, input.deviceId ?? null]);

  return { id, code, expiresAt, cooldownUntil };
}

/** Locks the newest challenge, increments failed attempts atomically, and issues a hashed one-time token. */
export async function verifyPhoneVerificationCode(
  client: PoolClient,
  phone: string,
  purpose: PhoneOtpPurpose,
  code: string,
): Promise<VerifiedPhoneChallenge | null> {
  if (!E164.test(phone) || !PURPOSES.has(purpose) || !CODE.test(code)) {
    throw new Error('Invalid phone verification input.');
  }
  const selected = await client.query<{
    id: string; phone: string; purpose: PhoneOtpPurpose; code_hash: string;
    code_salt: string; attempts: number; max_attempts: number;
    expires_at: Date; verified_at: Date | null; consumed_at: Date | null;
    superseded_at: Date | null;
  }>(`
    SELECT id, phone, purpose, code_hash, code_salt, attempts, max_attempts,
           expires_at, verified_at, consumed_at, superseded_at
    FROM verification_challenges
    WHERE phone = $1 AND purpose = $2
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE
  `, [phone, purpose]);
  const row = selected.rows[0];
  if (!row || row.consumed_at || row.superseded_at || row.verified_at ||
      new Date(row.expires_at).getTime() <= Date.now() || row.attempts >= row.max_attempts) {
    return null;
  }

  const candidate = createHmac('sha256', row.code_salt).update(code).digest();
  const expected = Buffer.from(row.code_hash, 'hex');
  const matches = expected.length === candidate.length && timingSafeEqual(expected, candidate);
  if (!matches) {
    await client.query(`
      UPDATE verification_challenges
      SET attempts = attempts + 1,
          superseded_at = CASE WHEN attempts + 1 >= max_attempts THEN now() ELSE superseded_at END
      WHERE id = $1 AND verified_at IS NULL AND consumed_at IS NULL
    `, [row.id]);
    return null;
  }

  const verificationToken = 'gb_pvtok_' + randomBytes(32).toString('hex');
  const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const updated = await client.query(`
    UPDATE verification_challenges
    SET verified_at = now(), verification_token_hash = $2,
        verification_expires_at = $3, consumed_at = now()
    WHERE id = $1 AND verified_at IS NULL AND consumed_at IS NULL
    RETURNING id
  `, [row.id, digestToken(verificationToken), verificationExpiresAt]);
  if (updated.rowCount !== 1) return null;
  return { challengeId: row.id, phone: row.phone, purpose: row.purpose,
    verificationToken, verificationExpiresAt };
}

/** Consumes a verified bearer token exactly once; caller must hold a transaction. */
export async function consumePhoneVerificationToken(
  client: PoolClient,
  phone: string,
  purpose: PhoneOtpPurpose,
  verificationToken: string,
): Promise<boolean> {
  if (!E164.test(phone) || !PURPOSES.has(purpose) ||
      typeof verificationToken !== 'string' ||
      !/^gb_pvtok_[a-f0-9]{64}$/.test(verificationToken)) {
    throw new Error('Invalid phone verification token.');
  }
  const result = await client.query(`
    UPDATE verification_challenges
    SET verification_token_consumed_at = now()
    WHERE phone = $1 AND purpose = $2
      AND verification_token_hash = $3
      AND verification_expires_at > now()
      AND verified_at IS NOT NULL
      AND verification_token_consumed_at IS NULL
  `, [phone, purpose, digestToken(verificationToken)]);
  return result.rowCount === 1;
}

/** Removes expired challenge metadata in bounded batches; never logs challenge material. */
export async function prunePhoneVerificationChallenges(
  client: PoolClient,
  batchSize = 500,
): Promise<number> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error('Invalid verification cleanup batch size.');
  }
  const result = await client.query(`
    WITH expired AS (
      SELECT id FROM verification_challenges
      WHERE expires_at <= now() - interval '1 day'
         OR (consumed_at IS NOT NULL AND consumed_at <= now() - interval '1 day')
      ORDER BY created_at
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM verification_challenges v
    USING expired e
    WHERE v.id = e.id
  `, [batchSize]);
  return result.rowCount ?? 0;
}
