import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccount, findAccountForLogin } from '../src/server/repositories/accounts';
import type { PoolClient } from 'pg';

function fakeClient(responses: unknown[][] = []) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows: responses.shift() ?? [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  return { client, calls };
}

const valid = {
  id: 'acct_1',
  username: 'sample_user',
  email: 'USER@example.com',
  phone: '+14155552671',
  displayName: 'Sample User',
  passwordHash: 'a'.repeat(128),
  passwordSalt: 'b'.repeat(32),
};

test('account creation normalizes identifiers and writes a transactional outbox event', async () => {
  const { client, calls } = fakeClient([[{ id: 'acct_1' }], [{ event_id: 'evt_1' }]]);
  assert.deepEqual(await createAccount(client, valid), { id: 'acct_1' });
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /INSERT INTO accounts/);
  assert.match(calls[0].sql, /username_normalized/);
  assert.match(calls[0].sql, /phone_normalized/);
  assert.deepEqual(calls[0].values, [
    'acct_1', 'sample_user', 'user@example.com', '+14155552671',
    'Sample User', valid.passwordHash, valid.passwordSalt, 'region-unassigned',
  ]);
  assert.match(calls[1].sql, /INSERT INTO event_outbox/);
});

test('account creation rejects malformed password hashes before database access', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => createAccount(client, { ...valid, passwordHash: 'plaintext-password' }));
  await assert.rejects(() => createAccount(client, { ...valid, passwordSalt: 'short' }));
  assert.equal(calls.length, 0);
});

test('account creation rejects invalid username, email and non-E.164 phone', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => createAccount(client, { ...valid, username: 'x' }));
  await assert.rejects(() => createAccount(client, { ...valid, email: 'not-an-email' }));
  await assert.rejects(() => createAccount(client, { ...valid, phone: '9999999999' }));
  assert.equal(calls.length, 0);
});

test('login lookup uses parameterized normalized username/email and E.164 phone', async () => {
  const row = {
    id: 'acct_1', username: 'sample_user', email: 'user@example.com',
    phone: '+14155552671', display_name: 'Sample User',
    password_hash: 'a'.repeat(128), password_salt: 'b'.repeat(32),
    account_status: 'active',
  };
  const { client, calls } = fakeClient([[row]]);
  assert.equal(await findAccountForLogin(client, 'USER@example.com'), row);
  assert.match(calls[0].sql, /username_normalized = \$1/);
  assert.match(calls[0].sql, /email_normalized = \$1/);
  assert.match(calls[0].sql, /phone_normalized = \$2/);
  assert.deepEqual(calls[0].values, ['user@example.com', 'USER@example.com']);
});

test('login lookup rejects empty or oversized identifiers before database access', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => findAccountForLogin(client, '   '));
  await assert.rejects(() => findAccountForLogin(client, 'x'.repeat(255)));
  assert.equal(calls.length, 0);
});
