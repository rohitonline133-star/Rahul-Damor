import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';
import { consumeApiRequestQuota } from '../src/server/repositories/api-request-rate-limits';

function fakeClient(responses: Array<{ rows?: unknown[]; rowCount?: number }>) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return responses.shift() ?? { rows: [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  return { client, calls };
}

const secret = 'api-rate-limit-secret-'.padEnd(40, 'x');
const now = new Date('2026-11-22T12:00:00.000Z');

test('API quota stores only keyed digests and increments every supplied bucket', async () => {
  const quotas = [
    { scope: 'ip' as const, value: '127.0.0.1', maxRequests: 600 },
    { scope: 'route' as const, value: 'auth:POST', maxRequests: 240 },
  ];
  const { client, calls } = fakeClient([{}, {}, { rows: [] }, { rows: [] }]);
  assert.deepEqual(await consumeApiRequestQuota(client, quotas, secret, now), { allowed: true });
  assert.equal(calls.length, 6);
  const expected = [
    createHmac('sha256', secret).update('ip:127.0.0.1').digest('hex'),
    createHmac('sha256', secret).update('route:auth:POST').digest('hex'),
  ];
  assert.deepEqual(calls.slice(4).map((call) => call.values?.[1]), expected);
});

test('quota blocks the next request after the configured maximum', async () => {
  const { client, calls } = fakeClient([
    {}, { rows: [{ request_count: 2, window_started_at: new Date(now.getTime() - 1000), blocked_until: null }] },
  ]);
  const result = await consumeApiRequestQuota(client, [
    { scope: 'ip', value: '127.0.0.1', maxRequests: 2 },
  ], secret, now);
  assert.deepEqual(result, { allowed: false, scope: 'ip', retryAfterSeconds: 60 });
  assert.match(calls[2].sql, /SET blocked_until/);
});

test('active blocks are honored without incrementing counters', async () => {
  const { client, calls } = fakeClient([
    {}, { rows: [{ request_count: 2, window_started_at: now, blocked_until: new Date(now.getTime() + 15000) }] },
  ]);
  assert.deepEqual(await consumeApiRequestQuota(client, [
    { scope: 'ip', value: '127.0.0.1', maxRequests: 2 },
  ], secret, now), { allowed: false, scope: 'ip', retryAfterSeconds: 15 });
  assert.equal(calls.length, 2);
});

test('invalid quota input is rejected before database access', async () => {
  const { client, calls } = fakeClient([]);
  await assert.rejects(() => consumeApiRequestQuota(client, [], secret, now));
  await assert.rejects(() => consumeApiRequestQuota(client, [
    { scope: 'ip', value: '', maxRequests: 2 },
  ], secret, now));
  assert.equal(calls.length, 0);
});
