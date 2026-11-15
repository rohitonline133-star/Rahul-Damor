import type { PoolClient } from 'pg';
import { insertOutboxEvent } from '../outbox';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_BODY_BYTES = 64 * 1024;

function validId(value: string, field: string): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new Error(`Invalid ${field}.`);
  return value;
}

export type NewConversation = {
  id: string;
  ownerId: string;
  type: 'direct' | 'group' | 'community' | 'channel';
  metadata?: Record<string, unknown>;
};

export async function createConversation(
  client: PoolClient,
  input: NewConversation,
): Promise<{ id: string }> {
  validId(input.id, 'conversation ID');
  validId(input.ownerId, 'owner ID');
  if (!['direct', 'group', 'community', 'channel'].includes(input.type)) {
    throw new Error('Invalid conversation type.');
  }
  const metadata = input.metadata ?? {};
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) ||
      Buffer.byteLength(JSON.stringify(metadata), 'utf8') > 16 * 1024) {
    throw new Error('Invalid conversation metadata.');
  }
  await client.query(`
    INSERT INTO conversations (id, conversation_type, metadata)
    VALUES ($1, $2, $3::jsonb)
  `, [input.id, input.type, JSON.stringify(metadata)]);
  await client.query(`
    INSERT INTO conversation_members (conversation_id, user_id, role)
    VALUES ($1, $2, 'owner')
  `, [input.id, input.ownerId]);
  await insertOutboxEvent(client, {
    aggregateType: 'conversation',
    aggregateId: input.id,
    eventType: 'created',
    partitionKey: input.id,
    payload: { conversationId: input.id, ownerId: input.ownerId, type: input.type },
  });
  return { id: input.id };
}

export type NewMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  body: Record<string, unknown>;
  ownerRegion?: string;
};

/**
 * A message is inserted only if the sender is a member of the conversation.
 * The client message ID makes retries idempotent per sender.
 */
export async function sendMessage(
  client: PoolClient,
  input: NewMessage,
): Promise<{ id: string; duplicate: boolean }> {
  validId(input.id, 'message ID');
  validId(input.conversationId, 'conversation ID');
  validId(input.senderId, 'sender ID');
  if (typeof input.clientMessageId !== 'string' || !CLIENT_ID_PATTERN.test(input.clientMessageId)) {
    throw new Error('Invalid client message ID.');
  }
  if (!input.body || typeof input.body !== 'object' || Array.isArray(input.body) ||
      Buffer.byteLength(JSON.stringify(input.body), 'utf8') > MAX_BODY_BYTES) {
    throw new Error('Invalid message body.');
  }
  const ownerRegion = input.ownerRegion ?? 'region-unassigned';
  if (typeof ownerRegion !== 'string' || !/^[a-z0-9-]{1,64}$/.test(ownerRegion)) {
    throw new Error('Invalid message owner region.');
  }

  const inserted = await client.query<{ id: string }>(`
    INSERT INTO messages (id, conversation_id, sender_id, client_message_id, body, owner_region)
    SELECT $1, cm.conversation_id, cm.user_id, $4, $5::jsonb, $6
    FROM conversation_members cm
    WHERE cm.conversation_id = $2 AND cm.user_id = $3
    ON CONFLICT (sender_id, client_message_id) DO NOTHING
    RETURNING id
  `, [
    input.id, input.conversationId, input.senderId,
    input.clientMessageId, JSON.stringify(input.body), ownerRegion,
  ]);

  if (inserted.rows[0]) {
    await insertOutboxEvent(client, {
      aggregateType: 'message',
      aggregateId: inserted.rows[0].id,
      eventType: 'created',
      partitionKey: input.conversationId,
      payload: {
        messageId: inserted.rows[0].id,
        conversationId: input.conversationId,
        senderId: input.senderId,
      },
    });
    return { id: inserted.rows[0].id, duplicate: false };
  }

  const existing = await client.query<{ id: string }>(`
    SELECT id FROM messages
    WHERE sender_id = $1 AND client_message_id = $2
      AND conversation_id = $3
    LIMIT 1
  `, [input.senderId, input.clientMessageId, input.conversationId]);
  if (existing.rows[0]) return { id: existing.rows[0].id, duplicate: true };

  // Distinguish an authorization failure from an idempotent retry without
  // leaking whether an unrelated message ID exists.
  const membership = await client.query(`
    SELECT 1 FROM conversation_members
    WHERE conversation_id = $1 AND user_id = $2
    LIMIT 1
  `, [input.conversationId, input.senderId]);
  if (!membership.rows[0]) throw new Error('Sender is not a conversation member.');
  throw new Error('Message could not be inserted; retry with a new client message ID.');
}
