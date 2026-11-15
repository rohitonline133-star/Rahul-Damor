-- Durable consumer deduplication and replay checkpoints.
-- Consumers must write the receipt/checkpoint in the same transaction as
-- their domain side effect. This schema does not itself implement consumers.
CREATE TABLE IF NOT EXISTS consumer_event_receipts (
  consumer_name text NOT NULL,
  event_id uuid NOT NULL,
  partition_key text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'processed'
    CHECK (outcome IN ('processed', 'ignored', 'quarantined')),
  PRIMARY KEY (consumer_name, event_id)
);
CREATE INDEX IF NOT EXISTS consumer_event_receipts_processed_idx
  ON consumer_event_receipts(consumer_name, processed_at DESC);

CREATE TABLE IF NOT EXISTS consumer_checkpoints (
  consumer_name text NOT NULL,
  stream_name text NOT NULL,
  partition_key text NOT NULL,
  last_stream_sequence bigint NOT NULL DEFAULT 0 CHECK (last_stream_sequence >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, stream_name, partition_key)
);
