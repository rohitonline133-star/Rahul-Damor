import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccount,
  findAccountForLogin,
  findPublicAccount,
} from '../src/server/repositories/accounts';
import type { PoolClient } from 'pg';

function fakeClient(rows: unknown[][] = []) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows: rows.shift() ?? [] };
    },
  } as unknown as PoolClient;
  return { client, calls };
}

test('account creation writes parameterized account and outbox records in caller transaction', async () => {
  const { client, calls } = fakeClient([[{ id: 'acct_1' }], [{ event_id: 'event-1' }]]);
  const result = await createAccount(client, {
    id: 'acct_1',
    username: 'Sample_User',
    email: 'USER@example.com',
    phone: '+14155552671',
    displayName: 'Sample User',
    passwordHash: 'a'.repeat(128),
    passwordSalt: 'b'.repeat(32),
  });
  assert.deepEqual(result, { id: 'acct_1' });
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /INSERT INTO accounts/);
  assert.deepEqual(calls[0].values, [
    'acct_1', 'Sample_User', 'user@example.com', '+14155552671',
    'Sample User', 'a'.repeat(128), 'b'.repeat(32), 'region-unassigned',
  ]);
  assert.match(calls[1].sql, /INSERT INTO event_outbox/);
  assert.equal(JSON.stringify(calls[1].values).includes('USER@example.com'), false);
});

test('account creation rejects malformed identifiers, email and non-E.164 phone before SQL', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => createAccount(client, {
    id: 'bad id', username: 'ok_user', displayName: 'Name',
    passwordHash: 'hash', passwordSalt: 'salt',
  }));
  await assert.rejects(() => createAccount(client, {
    id: 'acct_2', username: 'ok_user', email: 'not-an-email', displayName: 'Name',
    passwordHash: 'hash', passwordSalt: 'salt',
  }));
  await assert.rejects(() => createAccount(client, {
    id: 'acct_3', username: 'ok_user', phone: '12345', displayName: 'Name',
    passwordHash: 'hash', passwordSalt: 'salt',
  }));
  assert.equal(calls.length, 0);
});

test('login lookup uses normalized username/email and canonical phone parameters', async () => {
  const expected = { id: 'acct_1', username: 'sample', password_hash: 'hash' };
  const { client, calls } = fakeClient([[expected]]);
  const result = await findAccountForLogin(client, 'USER@EXAMPLE.COM');
  assert.equal(result, expected);
  assert.deepEqual(calls[0].values, ['user@example.com', 'USER@EXAMPLE.COM']);
});

test('public account lookup never selects credential or contact fields', async () => {
  const { client, calls } = fakeClient([[{
    id: 'acct_1', username: 'sample', display_name: 'Sample', created_at: new Date(),
  }]]);
  await findPublicAccount(client, 'acct_1');
  assert.match(calls[0].sql, /SELECT id, username, display_name, created_at/);
  assert.doesNotMatch(calls[0].sql, /password_hash|password_salt|email|phone/);
});
