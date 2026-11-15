import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  deleteExpiredIdempotencyKeys,
  hashIdempotencyRequest,
} from '../src/server/repositories/idempotency';

const input = {
  scope: 'payments.create',
  key: 'request_key_12345678',
  requestHash: hashIdempotencyRequest('{"amount":1250,"currency":"INR"}'),
};

function fakeClient(results: Array<{ rows?: unknown[]; rowCount: number }> = []) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return results.shift() ?? { rows: [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  return { client, calls };
}

test('first request claims an idempotency key', async () => {
  const { client, calls } = fakeClient([{ rows: [{ idempotency_key: input.key }], rowCount: 1 }]);
  assert.deepEqual(await claimIdempotencyKey(client, input), { kind: 'claimed' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /ON CONFLICT \(scope, idempotency_key\) DO NOTHING/);
});

test('completed request returns the stored response for an identical retry', async () => {
  const { client } = fakeClient([
    { rows: [], rowCount: 0 },
    { rows: [{ request_hash: input.requestHash, response: { orderId: 'order_1' }, expired: false }], rowCount: 1 },
  ]);
  assert.deepEqual(await claimIdempotencyKey(client, input), {
    kind: 'replay', response: { orderId: 'order_1' },
  });
});

test('same key with a different request hash is rejected', async () => {
  const { client } = fakeClient([
    { rows: [], rowCount: 0 },
    { rows: [{ request_hash: 'a'.repeat(64), response: null, expired: false }], rowCount: 1 },
  ]);
  await assert.rejects(() => claimIdempotencyKey(client, input), /different request/);
});

test('uncompleted matching request is reported as in progress', async () => {
  const { client } = fakeClient([
    { rows: [], rowCount: 0 },
    { rows: [{ request_hash: input.requestHash, response: null, expired: false }], rowCount: 1 },
  ]);
  assert.deepEqual(await claimIdempotencyKey(client, input), { kind: 'in_progress' });
});

test('completion stores only bounded JSON response under matching claim', async () => {
  const { client, calls } = fakeClient([{ rows: [], rowCount: 1 }]);
  await completeIdempotencyKey(client, { ...input, response: { result: 'ok' } });
  assert.match(calls[0].sql, /response IS NULL AND expires_at > now\(\)/);
  assert.deepEqual(calls[0].values?.slice(0, 3), [input.scope, input.key, input.requestHash]);
});

test('completion rejects null response because null marks an unfinished claim', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => completeIdempotencyKey(client, { ...input, response: null }), /non-null JSON/);
  assert.equal(calls.length, 0);
});

test('expired claims use the database clock rather than the API host clock', async () => {
  const { client, calls } = fakeClient([
    { rows: [], rowCount: 0 },
    { rows: [{ request_hash: input.requestHash, response: null, expired: true }], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);
  assert.deepEqual(await claimIdempotencyKey(client, input), { kind: 'claimed' });
  assert.match(calls[1].sql, /expires_at <= now\(\)/);
  assert.match(calls[2].sql, /SET response = NULL, request_hash = \$3/);
});

test('completion rejects oversized response and cleanup uses bounded batch', async () => {
  const { client, calls } = fakeClient([{ rows: [], rowCount: 7 }]);
  await assert.rejects(() => completeIdempotencyKey(client, {
    ...input, response: { value: 'x'.repeat(70 * 1024) },
  }), /size/);
  assert.equal(await deleteExpiredIdempotencyKeys(client, 7), 7);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FOR UPDATE SKIP LOCKED/);
});

test('invalid scope, key, hash, and retention are rejected', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => claimIdempotencyKey(client, { ...input, key: 'tiny' }));
  await assert.rejects(() => claimIdempotencyKey(client, { ...input, scope: 'bad scope' }));
  await assert.rejects(() => claimIdempotencyKey(client, { ...input, requestHash: 'not-a-hash' }));
  await assert.rejects(() => claimIdempotencyKey(client, { ...input, ttlMs: 1 }));
  assert.equal(calls.length, 0);
});
