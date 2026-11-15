import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createPersistentSession,
  findPersistentSession,
  revokePersistentSession,
  revokeAllPersistentSessions,
  listPersistentSessions,
  revokePersistentSessionById,
} from '../src/server/repositories/sessions';
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

test('persistent session stores a SHA-256 digest, never the bearer token', async () => {
  const { client, calls } = fakeClient();
  const session = await createPersistentSession(client, 'acct_1', {
    deviceName: 'Android Device', platform: 'Android',
    ip: '127.0.0.1', userAgent: 'GB Official test',
  });
  assert.match(session.token, /^gb_tok_[a-f0-9]{64}$/);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO user_sessions/);
  assert.equal(calls[0].values?.[2], createHash('sha256').update(session.token).digest('hex'));
  assert.notEqual(calls[0].values?.[2], session.token);
});

test('session lookup hashes the supplied token and only returns live records', async () => {
  const token = 'gb_tok_' + 'a'.repeat(64);
  const row = { id: 'sess_1', user_id: 'acct_1', expires_at: new Date(), revoked_at: null, created_at: new Date(), device_metadata: {} };
  const { client, calls } = fakeClient([[row]]);
  assert.equal(await findPersistentSession(client, token), row);
  assert.match(calls[0].sql, /revoked_at IS NULL AND expires_at > now()/);
  assert.equal(calls[0].values?.[0], createHash('sha256').update(token).digest('hex'));
});

test('invalid tokens are rejected before database access', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => findPersistentSession(client, 'not-a-token'));
  await assert.rejects(() => revokePersistentSession(client, 'not-a-token'));
  assert.equal(calls.length, 0);
});

test('revocation is atomic and scoped to the provided user', async () => {
  const { client, calls } = fakeClient([], 3);
  assert.equal(await revokeAllPersistentSessions(client, 'acct_1'), 3);
  assert.match(calls[0].sql, /WHERE user_id = \$1 AND revoked_at IS NULL/);
  assert.deepEqual(calls[0].values, ['acct_1']);
});

test('session lifetime and metadata are bounded before database access', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => createPersistentSession(client, 'acct_1', {
    deviceName: 'Phone', platform: 'Android',
  }, 0));
  await assert.rejects(() => createPersistentSession(client, 'acct_1', {
    deviceName: 'x'.repeat(121), platform: 'Android',
  }));
  assert.equal(calls.length, 0);
});

test('session listing is account-scoped and excludes expired or revoked rows', async () => {
  const rows = [{ id: 'sess_1', user_id: 'acct_1', expires_at: new Date(), revoked_at: null, created_at: new Date(), device_metadata: { platform: 'Android' } }];
  const { client, calls } = fakeClient([rows]);
  assert.deepEqual(await listPersistentSessions(client, 'acct_1'), rows);
  assert.match(calls[0].sql, /user_id = \$1 AND revoked_at IS NULL AND expires_at > now\(\)/);
  assert.equal(calls[0].values?.[0], 'acct_1');
});

test('single-session revocation requires matching account ownership', async () => {
  const { client, calls } = fakeClient([], 1);
  assert.equal(await revokePersistentSessionById(client, 'acct_1', 'sess_2'), true);
  assert.match(calls[0].sql, /WHERE id = \$1 AND user_id = \$2 AND revoked_at IS NULL/);
  assert.deepEqual(calls[0].values, ['sess_2', 'acct_1']);
});

test('session listing and revocation reject malformed identifiers before database access', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => listPersistentSessions(client, 'bad id'));
  await assert.rejects(() => revokePersistentSessionById(client, 'acct_1', 'other-session'));
  assert.equal(calls.length, 0);
});
