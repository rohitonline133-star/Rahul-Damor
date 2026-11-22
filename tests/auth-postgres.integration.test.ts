import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { createPhoneVerificationChallenge, verifyPhoneVerificationCode, consumePhoneVerificationToken } from '../src/server/repositories/phone-verifications';
import { registerAccountWithSession, loginWithPassword } from '../src/server/auth-service';
import { findPersistentSession } from '../src/server/repositories/sessions';

test('OTP verification, token consumption, account creation and session share one PostgreSQL transaction', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const { withPostgresTransaction, postgresPool } = await import('../src/server/postgres');
  const pepper = randomUUID() + randomUUID();
  const phone = '+1' + randomInt(2_000_000_000, 9_999_999_999).toString();
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const blockerId = 'acct_block_' + suffix;
  const accountId = 'acct_reg_' + suffix;
  const blockerUsername = 'block_' + suffix.slice(0, 8);
  const username = 'user_' + suffix.slice(0, 8);
  const email = 'auth-' + suffix + '@example.test';
  const password = 'correct-horse-battery';
  const metadata = { deviceName: 'Integration test', platform: 'Test' };
  let usedVerificationToken = '';
  try {
    await withPostgresTransaction((client) => registerAccountWithSession(client, {
      id: blockerId, username: blockerUsername, displayName: 'Unique blocker',
      password: 'blocker-password-123', sessionMetadata: metadata,
    }));
    const challenge = await withPostgresTransaction((client) => createPhoneVerificationChallenge(client, {
      phone, purpose: 'register', ttlMs: 5 * 60_000, cooldownMs: 0, maxAttempts: 5,
    }, pepper));
    await assert.rejects(() => withPostgresTransaction(async (client) => {
      const verified = await verifyPhoneVerificationCode(client, phone, 'register', challenge.code, pepper);
      assert.ok(verified);
      assert.equal(await consumePhoneVerificationToken(client, phone, 'register', verified.verificationToken), true);
      await registerAccountWithSession(client, {
        id: accountId, username: blockerUsername, email, phone, displayName: 'Must roll back',
        password, sessionMetadata: metadata,
      });
    }));
    const afterRollback = await postgresPool.query<{ verified_at: Date | null; verification_token_consumed_at: Date | null }>(
      'SELECT verified_at, verification_token_consumed_at FROM verification_challenges WHERE id = $1', [challenge.id],
    );
    assert.equal(afterRollback.rowCount, 1);
    assert.equal(afterRollback.rows[0].verified_at, null);
    assert.equal(afterRollback.rows[0].verification_token_consumed_at, null);
    const registered = await withPostgresTransaction(async (client) => {
      const verified = await verifyPhoneVerificationCode(client, phone, 'register', challenge.code, pepper);
      assert.ok(verified);
      usedVerificationToken = verified.verificationToken;
      assert.equal(await consumePhoneVerificationToken(client, phone, 'register', usedVerificationToken), true);
      return registerAccountWithSession(client, {
        id: accountId, username, email, phone, displayName: 'Registered account',
        password, sessionMetadata: metadata,
      });
    });
    assert.equal(registered.id, accountId);
    assert.match(registered.session.token, /^gb_tok_[a-f0-9]{64}$/);
    const login = await withPostgresTransaction((client) => loginWithPassword(client, username, password, metadata));
    assert.ok(login);
    assert.equal(login.id, accountId);
    const session = await withPostgresTransaction((client) => findPersistentSession(client, registered.session.token));
    assert.ok(session);
    assert.equal(session.user_id, accountId);
    const replay = await withPostgresTransaction((client) => consumePhoneVerificationToken(client, phone, 'register', usedVerificationToken));
    assert.equal(replay, false);
  } finally {
    await postgresPool.query('DELETE FROM accounts WHERE id = ANY($1::text[])', [[blockerId, accountId]]);
    await postgresPool.query('DELETE FROM event_outbox WHERE aggregate_id = ANY($1::text[])', [[blockerId, accountId]]);
    await postgresPool.query('DELETE FROM verification_challenges WHERE phone = $1', [phone]);
  }
});