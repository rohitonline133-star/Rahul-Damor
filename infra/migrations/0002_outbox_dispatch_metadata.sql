-- Operational metadata for a future transactional outbox dispatcher.
-- Producers and consumers are not implemented yet; this migration alone does not
-- enable event publication or guarantee delivery.
ALTER TABLE event_outbox
  ADD COLUMN IF NOT EXISTS claim_id uuid,
  ADD COLUMN IF NOT EXISTS claimed_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

ALTER TABLE event_outbox
  ADD CONSTRAINT event_outbox_claim_pair_check
  CHECK ((claim_id IS NULL) = (claimed_until IS NULL));

CREATE INDEX IF NOT EXISTS event_outbox_claimable_idx
  ON event_outbox(occurred_at, event_id)
  WHERE published_at IS NULL AND dead_lettered_at IS NULL;

CREATE INDEX IF NOT EXISTS event_outbox_expired_claim_idx
  ON event_outbox(claimed_until)
  WHERE published_at IS NULL AND claim_id IS NOT NULL;
