import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const HEX24 = /^[a-f0-9]{24}$/;
const HEX32 = /^[a-f0-9]{32}$/;

export type EncryptedTotpSecret = {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: string;
};

/** Persist only application-encrypted TOTP secret material. Caller owns transaction. */
export async function saveEncryptedTotpSecret(
  client: PoolClient, userId: string, secret: EncryptedTotpSecret,
): Promise<void> {
  if (!ID.test(userId) || !secret || typeof secret.ciphertext !== 'string' ||
      secret.ciphertext.length < 1 || secret.ciphertext.length > 4096 ||
      !HEX24.test(secret.nonce) || !HEX32.test(secret.authTag) ||
      typeof secret.keyVersion !== 'string' || secret.keyVersion.length < 1 || secret.keyVersion.length > 64) {
    throw new Error('Invalid encrypted two-factor credential.');
  }
  await client.query(`
    INSERT INTO account_two_factor(user_id, secret_ciphertext, secret_nonce, secret_auth_tag, encryption_key_version, enabled_at)
    VALUES ($1,$2,$3,$4,$5,NULL)
    ON CONFLICT (user_id) DO UPDATE SET
      secret_ciphertext = EXCLUDED.secret_ciphertext,
      secret_nonce = EXCLUDED.secret_nonce,
      secret_auth_tag = EXCLUDED.secret_auth_tag,
      encryption_key_version = EXCLUDED.encryption_key_version,
      enabled_at = NULL, updated_at = now()
  `, [userId, secret.ciphertext, secret.nonce, secret.authTag, secret.keyVersion]);
}

export async function getEncryptedTotpSecret(
  client: PoolClient, userId: string,
): Promise<EncryptedTotpSecret | null> {
  if (!ID.test(userId)) throw new Error('Invalid account ID.');
  const result = await client.query<{
    secret_ciphertext: string; secret_nonce: string; secret_auth_tag: string; encryption_key_version: string;
  }>(`SELECT secret_ciphertext, secret_nonce, secret_auth_tag, encryption_key_version
      FROM account_two_factor WHERE user_id = $1 AND enabled_at IS NOT NULL`, [userId]);
  const row = result.rows[0];
  return row ? { ciphertext: row.secret_ciphertext, nonce: row.secret_nonce,
    authTag: row.secret_auth_tag, keyVersion: row.encryption_key_version } : null;
}

export async function enableTwoFactor(client: PoolClient, userId: string): Promise<boolean> {
  if (!ID.test(userId)) throw new Error('Invalid account ID.');
  const result = await client.query(`UPDATE account_two_factor SET enabled_at = now(), updated_at = now()
    WHERE user_id = $1 AND enabled_at IS NULL`, [userId]);
  return result.rowCount === 1;
}

export async function disableTwoFactor(client: PoolClient, userId: string): Promise<boolean> {
  if (!ID.test(userId)) throw new Error('Invalid account ID.');
  const result = await client.query('DELETE FROM account_two_factor WHERE user_id = $1', [userId]);
  return result.rowCount === 1;
}

/** Consume one backup code atomically. Caller supplies an HMAC digest; plaintext is never stored. */
export async function consumeTwoFactorBackupCode(
  client: PoolClient, userId: string, codeHash: string,
): Promise<boolean> {
  if (!ID.test(userId) || !HEX64.test(codeHash)) throw new Error('Invalid backup code lookup.');
  const result = await client.query(`
    UPDATE account_two_factor_backup_codes SET consumed_at = now()
    WHERE user_id = $1 AND code_hash = $2 AND consumed_at IS NULL
      AND EXISTS (SELECT 1 FROM account_two_factor WHERE user_id = $1 AND enabled_at IS NOT NULL)
    RETURNING code_hash
  `, [userId, codeHash]);
  return result.rowCount === 1;
}

export async function replaceTwoFactorBackupCodes(
  client: PoolClient, userId: string, codeHashes: string[],
): Promise<void> {
  if (!ID.test(userId) || !Array.isArray(codeHashes) || codeHashes.length < 1 ||
      codeHashes.length > 20 || codeHashes.some(hash => !HEX64.test(hash)) ||
      new Set(codeHashes).size !== codeHashes.length) throw new Error('Invalid backup code set.');
  await client.query('DELETE FROM account_two_factor_backup_codes WHERE user_id = $1', [userId]);
  for (const hash of codeHashes) {
    await client.query('INSERT INTO account_two_factor_backup_codes(user_id, code_hash) VALUES ($1,$2)', [userId, hash]);
  }
}

/** Create a short-lived recovery challenge. codeHash must be HMAC-SHA256 using a server-side pepper. */
export async function createPasswordRecoveryChallenge(
  client: PoolClient, userId: string, codeHash: string, ttlMs = 10 * 60 * 1000,
): Promise<{ id: string; salt: string; expiresAt: Date }> {
  if (!ID.test(userId) || !HEX64.test(codeHash) || !Number.isInteger(ttlMs) ||
      ttlMs < 60_000 || ttlMs > 15 * 60 * 1000) throw new Error('Invalid password recovery challenge.');
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`password-recovery:${userId}`]);
  await client.query(`UPDATE password_recovery_challenges SET consumed_at = now()
    WHERE user_id = $1 AND consumed_at IS NULL`, [userId]);
  const id = 'pr_' + randomBytes(16).toString('hex');
  const salt = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMs);
  await client.query(`INSERT INTO password_recovery_challenges(id,user_id,code_hash,code_salt,expires_at)
    VALUES ($1,$2,$3,$4,$5)`, [id,userId,codeHash,salt,expiresAt]);
  return { id, salt, expiresAt };
}

/** Verify and consume a challenge in one transaction; caller derives HMAC with server-side pepper. */
export async function verifyAndConsumePasswordRecoveryChallenge(
  client: PoolClient, userId: string, candidateHash: string,
): Promise<boolean> {
  if (!ID.test(userId) || !HEX64.test(candidateHash)) throw new Error('Invalid password recovery verification.');
  const selected = await client.query<{id:string;code_hash:string;attempts:number;max_attempts:number;expires_at:Date}>(
    `SELECT id,code_hash,attempts,max_attempts,expires_at FROM password_recovery_challenges
     WHERE user_id = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [userId]);
  const row = selected.rows[0];
  if (!row || row.attempts >= row.max_attempts || new Date(row.expires_at).getTime() <= Date.now()) return false;
  const expected = Buffer.from(row.code_hash, 'hex');
  const actual = Buffer.from(candidateHash, 'hex');
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!match) {
    await client.query(`UPDATE password_recovery_challenges SET attempts = attempts + 1,
      consumed_at = CASE WHEN attempts + 1 >= max_attempts THEN now() ELSE consumed_at END
      WHERE id = $1 AND consumed_at IS NULL`, [row.id]);
    return false;
  }
  const consumed = await client.query(`UPDATE password_recovery_challenges SET consumed_at = now()
    WHERE id = $1 AND consumed_at IS NULL RETURNING id`, [row.id]);
  return consumed.rowCount === 1;
}

/** HMAC helper: pepper must come from a secret manager/environment, never the database. */
export function hashRecoveryCode(code: string, pepper: string): string {
  if (typeof code !== 'string' || !/^\\d{6}$/.test(code) ||
      typeof pepper !== 'string' || pepper.length < 32) throw new Error('Invalid recovery code configuration.');
  return createHmac('sha256', pepper).update(code).digest('hex');
}
