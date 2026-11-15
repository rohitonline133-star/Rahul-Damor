import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { loginWithPassword, registerAccountWithSession } from '../src/server/auth-service';
import type { PoolClient } from 'pg';

function fakeClient(responses: unknown[][]) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows: responses.shift() ?? [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  return { client, calls };
}

const metadata = { deviceName: 'Test device', platform: 'Web' };

test('registration creates account, outbox event and hashed persistent session', async () => {
  const { client, calls } = fakeClient([[{ id: 'acct_1' }], [{ event_id: 'evt_1' }], []]);
  const result = await registerAccountWithSession(client, {
    id: 'acct_1', username: 'sample_user', email: 'USER@example.com',
    displayName: 'Sample User', password: 'correct-horse-battery',
    sessionMetadata: metadata,
  });
  assert.equal(result.id, 'acct_1');
  assert.equal(result.email, 'user@example.com');
  assert.match(result.session.token, /^gb_tok_[a-f0-9]{64}$/);
  assert.equal(calls.length, 3);
  assert.match(calls[2].sql, /INSERT INTO user_sessions/);
  assert.notEqual(calls[2].values?.[2], result.session.token);
});

test('registration rejects short password before any database query', async () => {
  const { client, calls } = fakeClient([]);
  await assert.rejects(() => registerAccountWithSession(client, {
    id: 'acct_1', username: 'sample_user', displayName: 'Sample',
    password: 'short', sessionMetadata: metadata,
  }));
  assert.equal(calls.length, 0);
});

test('login verifies PBKDF2-SHA512 and creates session only for valid password', async () => {
  const salt = 'a'.repeat(32);
  const password = 'correct-horse-battery';
  const hash = pbkdf2Sync(password, salt, 310000, 64, 'sha512').toString('hex');
  const row = {
    id: 'acct_1', username: 'sample_user', email: 'sample@example.com',
    phone: null, display_name: 'Sample', password_hash: hash,
    password_salt: salt, account_status: 'active',
  };
  const { client, calls } = fakeClient([[row], []]);
  const result = await loginWithPassword(client, 'sample_user', password, metadata);
  assert.equal(result?.id, 'acct_1');
  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /INSERT INTO user_sessions/);
});

test('login rejects incorrect password and non-active account without session creation', async () => {
  const salt = 'b'.repeat(32);
  const hash = pbkdf2Sync('a-different-password', salt, 310000, 64, 'sha512').toString('hex');
  const row = {
    id: 'acct_1', username: 'sample_user', email: null, phone: null,
    display_name: 'Sample', password_hash: hash, password_salt: salt,
    account_status: 'active',
  };
  const { client, calls } = fakeClient([[row]]);
  assert.equal(await loginWithPassword(client, 'sample_user', 'incorrect-password', metadata), null);
  assert.equal(calls.length, 1);
});

test('login rejects suspended accounts', async () => {
  const { client, calls } = fakeClient([[
    { id: 'acct_1', username: 'sample_user', email: null, phone: null,
      display_name: 'Sample', password_hash: 'a'.repeat(128),
      password_salt: 'a'.repeat(32), account_status: 'suspended' },
  ]]);
  assert.equal(await loginWithPassword(client, 'sample_user', 'valid-password', metadata), null);
  assert.equal(calls.length, 1);
});
