import type { PoolClient } from 'pg';

export type InboxOutcome = 'processed' | 'ignored' | 'quarantined';

export type InboxEvent = {
  consumerName: string;
  eventId: string;
  partitionKey: string;
  streamName: string;
  streamSequence: number;
  outcome?: InboxOutcome;
};

export type InboxResult = {
  duplicate: boolean;
  checkpointAdvanced: boolean;
};

/**
 * Apply one broker event exactly once from the database's point of view.
 *
 * The caller MUST already have opened a PostgreSQL transaction and MUST commit
 * only after this function and the supplied side-effect callback succeed.
 * The receipt, callback side effects, and replay checkpoint share that
 * transaction. Broker delivery remains at-least-once.
 */
export async function processInboxEvent(
  client: PoolClient,
  event: InboxEvent,
  apply: (client: PoolClient) => Promise<void>,
): Promise<InboxResult> {
  const token = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
  if (!event || !token.test(event.consumerName) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.eventId) ||
      typeof event.partitionKey !== 'string' || event.partitionKey.length < 1 || event.partitionKey.length > 256 ||
      !token.test(event.streamName) ||
      !Number.isSafeInteger(event.streamSequence) || event.streamSequence < 1 ||
      !['processed', 'ignored', 'quarantined'].includes(event.outcome ?? 'processed') ||
      typeof apply !== 'function') {
    throw new Error('Invalid inbox event.');
  }

  const receipt = await client.query<{ event_id: string }>(`
    INSERT INTO consumer_event_receipts
      (consumer_name, event_id, partition_key, outcome)
    VALUES ($1, $2::uuid, $3, $4)
    ON CONFLICT (consumer_name, event_id) DO NOTHING
    RETURNING event_id
  `, [event.consumerName, event.eventId, event.partitionKey, event.outcome ?? 'processed']);

  if (receipt.rowCount !== 1) return { duplicate: true, checkpointAdvanced: false };

  // A thrown error aborts the caller's transaction, rolling back both receipt
  // and any side effects. Never catch and commit a partially applied event.
  await apply(client);

  const checkpoint = await client.query(`
    INSERT INTO consumer_checkpoints
      (consumer_name, stream_name, partition_key, last_stream_sequence)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (consumer_name, stream_name, partition_key)
    DO UPDATE SET
      last_stream_sequence = GREATEST(
        consumer_checkpoints.last_stream_sequence,
        EXCLUDED.last_stream_sequence
      ),
      updated_at = now()
    RETURNING last_stream_sequence
  `, [event.consumerName, event.streamName, event.partitionKey, event.streamSequence]);

  return { duplicate: false, checkpointAdvanced: checkpoint.rowCount === 1 };
}
