import { Pool } from 'pg';
import { connect, jetstream, JSONCodec, type NatsConnection } from 'nats';

type OutboxEvent = {
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  schema_version: number;
  partition_key: string;
  payload: unknown;
  occurred_at: Date;
  attempts: number;
  claim_id: string;
};

const databaseUrl = process.env.DATABASE_URL;
const natsUrl = process.env.NATS_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
if (!natsUrl) throw new Error('NATS_URL is required.');
const batchSize = Number(process.env.OUTBOX_BATCH_SIZE || 50);
const leaseMs = Number(process.env.OUTBOX_LEASE_MS || 30000);
const pollMs = Number(process.env.OUTBOX_POLL_MS || 500);
const maxAttempts = Number(process.env.OUTBOX_MAX_ATTEMPTS || 12);
for (const [name, value, min, max] of [
  ['OUTBOX_BATCH_SIZE', batchSize, 1, 500],
  ['OUTBOX_LEASE_MS', leaseMs, 1000, 300000],
  ['OUTBOX_POLL_MS', pollMs, 100, 60000],
  ['OUTBOX_MAX_ATTEMPTS', maxAttempts, 1, 100],
] as const) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
}

const sslMode = process.env.PGSSLMODE || 'verify-full';
if (!['disable', 'verify-full'].includes(sslMode)) throw new Error('PGSSLMODE must be disable or verify-full.');
const pool = new Pool({
  connectionString: databaseUrl,
  max: 4,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
  application_name: 'gb-official-outbox-dispatcher',
  ssl: sslMode === 'disable' ? false : { rejectUnauthorized: true },
});
const codec = JSONCodec<Record<string, unknown>>();
let nc: NatsConnection | undefined;
let stopping = false;

function subjectFor(event: OutboxEvent): string {
  const valid = /^[a-zA-Z0-9_-]+$/;
  if (!valid.test(event.aggregate_type) || !valid.test(event.event_type)) {
    throw new Error('invalid_event_subject');
  }
  return `gb.events.${event.aggregate_type}.${event.event_type}`;
}

async function claimBatch(): Promise<OutboxEvent[]> {
  // A worker may die after consuming its final attempt. Once its lease expires,
  // make that row terminal instead of leaving it permanently unclaimable.
  await pool.query(`
    UPDATE event_outbox
    SET dead_lettered_at = now(), claim_id = NULL, claimed_until = NULL,
        last_error_code = COALESCE(last_error_code, 'attempt_limit_reached')
    WHERE published_at IS NULL AND dead_lettered_at IS NULL
      AND attempts >= $1
      AND (claim_id IS NULL OR claimed_until < now())
  `, [maxAttempts]);
  const result = await pool.query<OutboxEvent>(`
    WITH candidates AS (
      SELECT event_id
      FROM event_outbox
      WHERE published_at IS NULL
        AND dead_lettered_at IS NULL
        AND (claim_id IS NULL OR claimed_until < now())
        AND attempts < $1
      ORDER BY occurred_at, event_id
      FOR UPDATE SKIP LOCKED
      LIMIT $2
    )
    UPDATE event_outbox AS event
    SET claim_id = gen_random_uuid(),
        claimed_until = now() + ($3::int * interval '1 millisecond'),
        last_attempt_at = now(),
        attempts = attempts + 1
    FROM candidates
    WHERE event.event_id = candidates.event_id
    RETURNING event.event_id, event.aggregate_type, event.aggregate_id,
      event.event_type, event.schema_version, event.partition_key,
      event.payload, event.occurred_at, event.attempts, event.claim_id
  `, [maxAttempts, batchSize, leaseMs]);
  return result.rows;
}

async function markPublished(event: OutboxEvent): Promise<void> {
  const result = await pool.query(`
    UPDATE event_outbox
    SET published_at = now(), claim_id = NULL, claimed_until = NULL,
        last_error_code = NULL
    WHERE event_id = $1 AND claim_id = $2 AND published_at IS NULL
  `, [event.event_id, event.claim_id]);
  if (result.rowCount !== 1) {
    // The lease was reclaimed or the row was otherwise changed. Do not overwrite
    // the newer owner's state; JetStream deduplication uses the stable event ID.
    throw new Error('outbox_claim_lost_after_publish');
  }
}

async function recordFailure(event: OutboxEvent): Promise<void> {
  await pool.query(`
    UPDATE event_outbox
    SET claim_id = NULL, claimed_until = NULL,
        last_error_code = 'jetstream_publish_failed',
        dead_lettered_at = CASE WHEN attempts >= $3 THEN now() ELSE NULL END
    WHERE event_id = $1 AND claim_id = $2 AND published_at IS NULL
  `, [event.event_id, event.claim_id, maxAttempts]);
}

async function dispatchOne(event: OutboxEvent): Promise<void> {
  if (!nc) throw new Error('nats_not_connected');
  const envelope = {
    id: event.event_id,
    type: event.event_type,
    schemaVersion: event.schema_version,
    aggregate: { type: event.aggregate_type, id: event.aggregate_id },
    partitionKey: event.partition_key,
    occurredAt: new Date(event.occurred_at).toISOString(),
    data: event.payload,
  };
  try {
    const ack = await jetstream(nc).publish(
      subjectFor(event),
      codec.encode(envelope),
      { msgID: event.event_id },
    );
    if (!ack.stream || ack.seq < 1) throw new Error('jetstream_ack_missing');
    await markPublished(event);
  } catch {
    await recordFailure(event);
    // Do not log event payloads, identifiers, or connection details.
    process.stderr.write('Outbox event publish failed; retry/dead-letter policy applied.\\n');
  }
}

async function main() {
  nc = await connect({ servers: natsUrl, name: 'gb-official-outbox-dispatcher', maxReconnectAttempts: -1 });
  process.stdout.write('Outbox dispatcher connected.\\n');
  while (!stopping) {
    const events = await claimBatch();
    if (events.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    for (const event of events) {
      if (stopping) break;
      await dispatchOne(event);
    }
  }
}

function stop() { stopping = true; }
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  await main();
} finally {
  await nc?.drain();
  await pool.end();
}
