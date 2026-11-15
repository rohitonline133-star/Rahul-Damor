import type { PoolClient } from 'pg';

export type OutboxEventInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  schemaVersion?: number;
  partitionKey: string;
  payload: Record<string, unknown>;
};

const SUBJECT_TOKEN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_AGGREGATE_ID = 256;
const MAX_PARTITION_KEY = 256;
const MAX_PAYLOAD_BYTES = 256 * 1024;
const FORBIDDEN_PAYLOAD_KEY = /^(?:password|password_hash|salt|token|access_token|refresh_token|session|otp|verification_code|secret|client_secret|private_key|cvv|cvc|pan|upi_pin)$/i;

function inspectPayload(value: unknown, depth = 0): void {
  if (depth > 12) throw new Error('Outbox payload nesting exceeds the supported depth.');
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new Error('Outbox payload array exceeds the supported size.');
    for (const item of value) inspectPayload(item, depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_PAYLOAD_KEY.test(key)) throw new Error('Outbox payload contains a prohibited sensitive field.');
      inspectPayload(item, depth + 1);
    }
    return;
  }
  if (typeof value === 'string' && value.length > 32_768) {
    throw new Error('Outbox payload string exceeds the supported size.');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('Outbox payload contains a non-finite number.');
  }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint' || value === undefined) {
    throw new Error('Outbox payload contains a non-JSON value.');
  }
}

export function validateOutboxEvent(input: OutboxEventInput): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Outbox event must be an object.');
  if (!SUBJECT_TOKEN.test(input.aggregateType)) throw new Error('Invalid outbox aggregate type.');
  if (!SUBJECT_TOKEN.test(input.eventType)) throw new Error('Invalid outbox event type.');
  if (typeof input.aggregateId !== 'string' || input.aggregateId.length < 1 || input.aggregateId.length > MAX_AGGREGATE_ID) {
    throw new Error('Invalid outbox aggregate ID.');
  }
  if (typeof input.partitionKey !== 'string' || input.partitionKey.length < 1 || input.partitionKey.length > MAX_PARTITION_KEY) {
    throw new Error('Invalid outbox partition key.');
  }
  const version = input.schemaVersion ?? 1;
  if (!Number.isInteger(version) || version < 1 || version > 2_147_483_647) {
    throw new Error('Invalid outbox schema version.');
  }
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    throw new Error('Outbox payload must be a JSON object.');
  }
  inspectPayload(input.payload);
  const serialized = JSON.stringify(input.payload);
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
    throw new Error('Outbox payload exceeds the 256 KiB limit.');
  }
}

/**
 * Insert an event using the same PostgreSQL client/transaction as the domain
 * mutation. The caller MUST invoke this before committing that transaction.
 * This helper deliberately does not open or commit its own transaction.
 */
export async function insertOutboxEvent(
  client: PoolClient,
  input: OutboxEventInput,
): Promise<string> {
  validateOutboxEvent(input);
  const result = await client.query<{ event_id: string }>(`
    INSERT INTO event_outbox (
      aggregate_type, aggregate_id, event_type, schema_version,
      partition_key, payload
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    RETURNING event_id
  `, [
    input.aggregateType,
    input.aggregateId,
    input.eventType,
    input.schemaVersion ?? 1,
    input.partitionKey,
    JSON.stringify(input.payload),
  ]);
  const eventId = result.rows[0]?.event_id;
  if (!eventId) throw new Error('PostgreSQL did not return an outbox event ID.');
  return eventId;
}
