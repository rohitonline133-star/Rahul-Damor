import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import {
  createPhoneVerificationChallenge,
  verifyPhoneVerificationCode,
  consumePhoneVerificationToken,
  prunePhoneVerificationChallenges,
} from '../src/server/repositories/phone-verifications';
import type { PoolClient } from 'pg';

function fakeClient(rows: unknown[][] = [], rowCount = 1) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows: rows.shift() ?? [], rowCount };
    },
  } as unknown as PoolClient;
  return { client, calls };
}

test('challenge creation stores only an HMAC digest and supersedes older challenges', async () => {
  const { client, calls } = fakeClient([[], []]);
  const issued = await createPhoneVerificationChallenge(client, {
    phone: '+14155552671', purpose: 'register', requestIp: '127.0.0.1',
  });
  assert.match(issued.code, /^[0-9]{6}$/);
  assert.match(issued.id, /^pv_[a-f0-9]{32}$/);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /SET superseded_at = now\(\)/);
  assert.match(calls[1].sql, /INSERT INTO verification_challenges/);
  assert.equal(calls[1].values?.[3], createHmac('sha256', String(calls[1].values?.[4])).update(issued.code).digest('hex'));
});

test('challenge limits and phone format are validated before database access', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => createPhoneVerificationChallenge(client, { phone: '12345', purpose: 'register' }));
  await assert.rejects(() => createPhoneVerificationChallenge(client, {
    phone: '+14155552671', purpose: 'register', ttlMs: 999999999,
  }));
  assert.equal(calls.length, 0);
});

test('successful OTP verification returns a bearer token whose SHA-256 digest is stored', async () => {
  const code = '123456', salt = 'a'.repeat(32);
  const hash = createHmac('sha256', salt).update(code).digest('hex');
  const { client, calls } = fakeClient([[
    { id: 'pv_1', phone: '+14155552671', purpose: 'register', code_hash: hash,
      code_salt: salt, attempts: 0, max_attempts: 5, expires_at: new Date(Date.now() + 60000),
      verified_at: null, consumed_at: null, superseded_at: null },
  ], [{ id: 'pv_1' }]]);
  const verified = await verifyPhoneVerificationCode(client, '+14155552671', 'register', code);
  assert.ok(verified);
  assert.match(verified.verificationToken, /^gb_pvtok_[a-f0-9]{64}$/);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.equal(calls[1].values?.[1], createHash('sha256').update(verified.verificationToken).digest('hex'));
});

test('incorrect OTP increments attempts and never issues a token', async () => {
  const { client, calls } = fakeClient([[
    { id: 'pv_1', phone: '+14155552671', purpose: 'register', code_hash: '0'.repeat(64),
      code_salt: 'a'.repeat(32), attempts: 0, max_attempts: 5, expires_at: new Date(Date.now() + 60000),
      verified_at: null, consumed_at: null, superseded_at: null },
  ]]);
  assert.equal(await verifyPhoneVerificationCode(client, '+14155552671', 'register', '123456'), null);
  assert.match(calls[1].sql, /attempts = attempts \+ 1/);
  assert.match(calls[1].sql, /max_attempts/);
});

test('verified token is hashed, purpose-scoped and atomically consumed', async () => {
  const token = 'gb_pvtok_' + 'b'.repeat(64);
  const { client, calls } = fakeClient([], 1);
  assert.equal(await consumePhoneVerificationToken(client, '+14155552671', 'register', token), true);
  assert.match(calls[0].sql, /verification_token_hash = \$3/);
  assert.match(calls[0].sql, /verification_expires_at > now\(\)/);
  assert.equal(calls[0].values?.[2], createHash('sha256').update(token).digest('hex'));
});

test('invalid token is rejected before database access', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => consumePhoneVerificationToken(client, '+14155552671', 'register', 'plain-token'));
  assert.equal(calls.length, 0);
});

test('expired challenge pruning is bounded', async () => {
  const { client, calls } = fakeClient([], 7);
  assert.equal(await prunePhoneVerificationChallenges(client, 100), 7);
  assert.match(calls[0].sql, /FOR UPDATE SKIP LOCKED/);
  assert.deepEqual(calls[0].values, [100]);
  await assert.rejects(() => prunePhoneVerificationChallenges(client, 100000));
});
