import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversation, sendMessage } from '../src/server/repositories/conversations';
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

test('conversation creation inserts owner membership and outbox event', async () => {
  const { client, calls } = fakeClient([[], [], [{ event_id: 'evt_1' }]]);
  assert.deepEqual(await createConversation(client, {
    id: 'conv_1', ownerId: 'acct_1', type: 'group',
    metadata: { title: 'Study group' },
  }), { id: 'conv_1' });
  assert.equal(calls.length, 3);
  assert.match(calls[1].sql, /conversation_members/);
  assert.match(calls[2].sql, /event_outbox/);
});

test('message creation requires membership in the insert query and emits outbox atomically', async () => {
  const { client, calls } = fakeClient([[{ id: 'msg_1' }], [{ event_id: 'evt_1' }]]);
  const result = await sendMessage(client, {
    id: 'msg_1', conversationId: 'conv_1', senderId: 'acct_1',
    clientMessageId: 'client_msg_12345678', body: { text: 'Hello' },
  });
  assert.deepEqual(result, { id: 'msg_1', duplicate: false });
  assert.match(calls[0].sql, /FROM conversation_members/);
  assert.match(calls[0].sql, /ON CONFLICT \(sender_id, client_message_id\) DO NOTHING/);
  assert.match(calls[1].sql, /INSERT INTO event_outbox/);
});

test('message retry returns existing row without emitting another event', async () => {
  const { client, calls } = fakeClient([[], [{ id: 'msg_existing' }]]);
  assert.deepEqual(await sendMessage(client, {
    id: 'msg_retry', conversationId: 'conv_1', senderId: 'acct_1',
    clientMessageId: 'client_msg_12345678', body: { text: 'Hello' },
  }), { id: 'msg_existing', duplicate: true });
  assert.equal(calls.length, 2);
});

test('non-members cannot create messages', async () => {
  const { client, calls } = fakeClient([[], [], []]);
  await assert.rejects(() => sendMessage(client, {
    id: 'msg_1', conversationId: 'conv_1', senderId: 'acct_2',
    clientMessageId: 'client_msg_12345678', body: { text: 'No access' },
  }), /not a conversation member/);
  assert.equal(calls.length, 3);
});

test('message payload and identifiers are bounded before SQL', async () => {
  const { client, calls } = fakeClient([]);
  await assert.rejects(() => sendMessage(client, {
    id: 'msg_1', conversationId: 'conv_1', senderId: 'acct_1',
    clientMessageId: 'short', body: { text: 'Hello' },
  }));
  await assert.rejects(() => sendMessage(client, {
    id: 'msg_1', conversationId: 'conv_1', senderId: 'acct_1',
    clientMessageId: 'client_msg_12345678', body: { text: 'x'.repeat(70_000) },
  }));
  assert.equal(calls.length, 0);
});
