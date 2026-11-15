import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOutboxEvent, type OutboxEventInput } from '../src/server/outbox';

const validEvent: OutboxEventInput = {
  aggregateType: 'message',
  aggregateId: 'message-123',
  eventType: 'created',
  schemaVersion: 1,
  partitionKey: 'conversation-9',
  payload: { conversationId: 'conversation-9', senderId: 'user-7', body: { text: 'Hello' } },
};

test('outbox event accepts a bounded, versioned domain event', () => {
  assert.doesNotThrow(() => validateOutboxEvent(validEvent));
});

test('outbox event rejects unsafe subject tokens and oversized identifiers', () => {
  assert.throws(() => validateOutboxEvent({ ...validEvent, aggregateType: 'message.created' }));
  assert.throws(() => validateOutboxEvent({ ...validEvent, eventType: 'created all' }));
  assert.throws(() => validateOutboxEvent({ ...validEvent, aggregateId: 'x'.repeat(257) }));
  assert.throws(() => validateOutboxEvent({ ...validEvent, partitionKey: '' }));
});

test('outbox event rejects invalid schema versions and non-object payloads', () => {
  assert.throws(() => validateOutboxEvent({ ...validEvent, schemaVersion: 0 }));
  assert.throws(() => validateOutboxEvent({ ...validEvent, schemaVersion: 1.5 }));
  assert.throws(() => validateOutboxEvent({ ...validEvent, payload: [] as unknown as Record<string, unknown> }));
  assert.throws(() => validateOutboxEvent({ ...validEvent, payload: null as unknown as Record<string, unknown> }));
});

test('outbox event rejects credential and authentication secrets recursively', () => {
  assert.throws(() => validateOutboxEvent({ ...validEvent, payload: { profile: { access_token: 'do-not-publish' } } }));
  assert.throws(() => validateOutboxEvent({ ...validEvent, payload: { otp: '123456' } }));
  assert.throws(() => validateOutboxEvent({ ...validEvent, payload: { payment: { cvv: '123' } } }));
});

test('outbox event rejects non-finite numbers and oversized payloads', () => {
  assert.throws(() => validateOutboxEvent({ ...validEvent, payload: { score: Number.NaN } }));
  assert.throws(() => validateOutboxEvent({ ...validEvent, payload: { text: 'x'.repeat(270_000) } }));
});
