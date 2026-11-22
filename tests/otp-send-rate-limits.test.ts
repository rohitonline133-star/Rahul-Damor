import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';
import { consumeOtpSendQuota } from '../src/server/repositories/otp-send-rate-limits';

function scriptedClient(responses: Array<{ rows?: unknown[]; rowCount?: number }>) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return responses.shift() ?? { rows: [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  return { client, calls };
}

const input = { phone: '+14155552671', ip: '127.0.0.1', deviceId: 'device-a' };
const secret = 's'.repeat(32);
const now = new Date('2026-11-22T12:00:00.000Z');

test('OTP quota hashes identifiers and increments all three scopes', async () => {
  const { client, calls } = scriptedClient([{}, {}, {}, { rows: [] }, { rows: [] }, { rows: [] }]);
  assert.deepEqual(await consumeOtpSendQuota(client, input, secret, now), { allowed: true });
  assert.equal(calls.length, 9);
  const expected = [
    createHmac('sha256', secret).update('device:' + input.deviceId).digest('hex'),
    createHmac('sha256', secret).update('ip:' + input.ip).digest('hex'),
    createHmac('sha256', secret).update('phone:' + input.phone).digest('hex'),
  ];
  assert.deepEqual(calls.slice(6).map((call) => call.values?.[1]), expected);
});

test('fourth phone request in the rolling window blocks sends for 30 minutes', async () => {
  const phoneHash = createHmac('sha256', secret).update('phone:' + input.phone).digest('hex');
  const { client, calls } = scriptedClient([
    {}, {}, {},
    { rows: [{ request_count: 3, window_started_at: new Date(now.getTime() - 1000), blocked_until: null }] },
    { rows: [] }, { rows: [] },
  ]);
  const result = await consumeOtpSendQuota(client, input, secret, now);
  assert.deepEqual(result, { allowed: false, scope: 'phone', retryAfterSeconds: 1800 });
  assert.equal(calls[5].values?.[1], phoneHash);
  assert.match(calls[6].sql, /SET blocked_until/);
  assert.equal(calls.length, 7);
});

test('active block is honored without incrementing quotas', async () => {
  const { client, calls } = scriptedClient([
    {}, {}, {},
    { rows: [{ request_count: 3, window_started_at: now, blocked_until: new Date(now.getTime() + 90000) }] },
    { rows: [] }, { rows: [] },
  ]);
  assert.deepEqual(await consumeOtpSendQuota(client, input, secret, now),
    { allowed: false, scope: 'phone', retryAfterSeconds: 90 });
  assert.equal(calls.length, 6);
});

test('invalid inputs fail before touching PostgreSQL', async () => {
  const { client, calls } = scriptedClient([]);
  await assert.rejects(() => consumeOtpSendQuota(client, { ...input, phone: 'bad' }, secret, now));
  await assert.rejects(() => consumeOtpSendQuota(client, input, 'short', now));
  assert.equal(calls.length, 0);
});
