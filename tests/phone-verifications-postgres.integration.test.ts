import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import {
  createPhoneVerificationChallenge,
  verifyPhoneVerificationCode,
  consumePhoneVerificationToken,
} from '../src/server/repositories/phone-verifications';

test('PostgreSQL OTP challenges enforce attempts and issue single-use hashed verification tokens', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const { postgresPool, withPostgresTransaction } = await import('../src/server/postgres');
  const pepper = randomUUID() + randomUUID();
  const phone = '+1' + randomInt(2_000_000_000, 9_999_999_999).toString();
  const blockedPhone = '+1' + randomInt(2_000_000_000, 9_999_999_999).toString();
  const createdPhones = [phone, blockedPhone];
  try {
    const issued = await withPostgresTransaction((client) =>
      createPhoneVerificationChallenge(client, {
        phone, purpose: 'register', ttlMs: 5 * 60_000, cooldownMs: 60_000, maxAttempts: 5,
      }, pepper)
    );
    const verified = await withPostgresTransaction((client) =>
      verifyPhoneVerificationCode(client, phone, 'register', issued.code, pepper)
    );
    assert.ok(verified);
    assert.equal(verified.phone, phone);
    assert.equal(verified.purpose, 'register');

    const storedToken = await postgresPool.query<{ verification_token_hash: string }>(
      'SELECT verification_token_hash FROM verification_challenges WHERE id = $1',
      [issued.id],
    );
    assert.equal(storedToken.rows[0].verification_token_hash,
      createHash('sha256').update(verified.verificationToken).digest('hex'));

    const consumeResults = await Promise.all([
      withPostgresTransaction((client) =>
        consumePhoneVerificationToken(client, phone, 'register', verified.verificationToken)
      ),
      withPostgresTransaction((client) =>
        consumePhoneVerificationToken(client, phone, 'register', verified.verificationToken)
      ),
    ]);
    assert.equal(consumeResults.filter(Boolean).length, 1);

    const blocked = await withPostgresTransaction((client) =>
      createPhoneVerificationChallenge(client, {
        phone: blockedPhone, purpose: 'register', maxAttempts: 5,
      }, pepper)
    );
    const wrongAttempts = await Promise.all(Array.from({ length: 8 }, () =>
      withPostgresTransaction((client) =>
        verifyPhoneVerificationCode(client, blockedPhone, 'register', '000000', pepper)
      )
    ));
    assert.ok(wrongAttempts.every((result) => result === null));
    const attempts = await postgresPool.query<{ attempts: number; superseded_at: Date | null }>(
      'SELECT attempts, superseded_at FROM verification_challenges WHERE id = $1',
      [blocked.id],
    );
    assert.equal(Number(attempts.rows[0].attempts), 5);
    assert.ok(attempts.rows[0].superseded_at instanceof Date);
  } finally {
    await postgresPool.query(
      'DELETE FROM verification_challenges WHERE phone = ANY($1::text[])',
      [createdPhones],
    );
  }
});
