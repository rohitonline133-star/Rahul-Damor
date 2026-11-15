import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { processInboxEvent } from '../src/server/inbox';

const event = {
  consumerName: 'realtime-fanout',
  eventId: '123e4567-e89b-42d3-a456-426614174000',
  partitionKey: 'user-42',
  streamName: 'GB_EVENTS',
  streamSequence: 12,
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

test('new event applies side effect and advances a monotonic checkpoint', async () => {
  const { client, calls } = fakeClient([
    { rows: [{ event_id: event.eventId }], rowCount: 1 },
    { rows: [{ last_stream_sequence: 12 }], rowCount: 1 },
  ]);
  let applied = 0;
  const result = await processInboxEvent(client, event, async (tx) => {
    assert.equal(tx, client);
    applied += 1;
  });
  assert.deepEqual(result, { duplicate: false, checkpointAdvanced: true });
  assert.equal(applied, 1);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /ON CONFLICT \(consumer_name, event_id\) DO NOTHING/);
  assert.match(calls[1].sql, /GREATEST\(/);
});

test('duplicate event does not repeat side effects or advance checkpoint', async () => {
  const { client, calls } = fakeClient([{ rows: [], rowCount: 0 }]);
  let applied = 0;
  const result = await processInboxEvent(client, event, async () => { applied += 1; });
  assert.deepEqual(result, { duplicate: true, checkpointAdvanced: false });
  assert.equal(applied, 0);
  assert.equal(calls.length, 1);
});

test('failed side effect rejects before checkpoint update', async () => {
  const { client, calls } = fakeClient([{ rows: [{ event_id: event.eventId }], rowCount: 1 }]);
  await assert.rejects(() => processInboxEvent(client, event, async () => {
    throw new Error('domain write failed');
  }), /domain write failed/);
  assert.equal(calls.length, 1);
});

test('invalid event metadata is rejected before database access', async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => processInboxEvent(client, { ...event, streamSequence: -1 }, async () => {}));
  assert.equal(calls.length, 0);
});
