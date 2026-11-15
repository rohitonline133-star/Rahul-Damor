# Transactional outbox delivery contract

**Status:** producer validation/insertion helper and a JetStream dispatcher are implemented on the infrastructure feature branch. Application domain routes do not yet call the producer, consumers are not implemented, and no regional broker topology is provisioned.

## Producer implementation

Use `insertOutboxEvent(client, input)` from `src/server/outbox.ts` with the exact PostgreSQL client that performed the domain mutation. The caller must insert the event before committing the same transaction; the helper deliberately does not create or commit transactions.

The helper validates subject tokens, aggregate/partition identifiers, schema versions, JSON shape, payload size/depth, and rejects common credential-bearing field names recursively. It uses parameterized SQL and returns the database-generated event ID. These checks are defense-in-depth, not a substitute for domain-specific data minimization or authorization.

## Required producer contract

1. Validate the command and authorize the actor before changing state.
2. In one database transaction, apply the domain mutation and insert an outbox row.
3. Use a stable aggregate identity, event type, schema version, and partition key.
4. Store only the minimum event payload needed by consumers. Never put passwords, bearer tokens, OTPs, payment credentials, or raw authentication secrets in events.
5. Commit before acknowledging success to the caller.
6. Enforce idempotency at the command boundary and at each consumer.

## Dispatcher implementation

`scripts/dispatch-outbox.ts` claims bounded batches with `FOR UPDATE SKIP LOCKED`, uses expiring per-row claims, publishes to JetStream with the stable event ID as message ID, and marks published only after broker acknowledgement. It records a fixed safe failure code and dead-letters after the configured attempt limit. It does not log event payloads or credentials.

Delivery is **at least once**, not exactly once. A crash after broker acknowledgement but before the database update can cause redelivery. Consumers must deduplicate.

The migration `0003_consumer_inbox.sql` adds `consumer_event_receipts` (unique per consumer/event) and per-partition `consumer_checkpoints`. These are primitives only; a consumer must commit its receipt/checkpoint atomically with its own domain side effect.\n\n## Required consumer contract

- Validate event type and schema version before processing.
- Persist a processed-event receipt in the same transaction as the consumer's domain side effect.
- Reject or quarantine unsupported schema versions.
- Preserve per-aggregate ordering where required; do not promise global ordering.
- Support bounded replay from a durable cursor and safe restart after a crash.
- Authorize subscriptions server-side; a client-supplied user ID is never an authorization credential.

## Remaining production gates

- Convert domain handlers to PostgreSQL repositories and insert outbox rows atomically with every supported mutation.
- Implement idempotent, authorized consumers and broker-backed realtime fanout.
- Add PostgreSQL + JetStream integration tests for concurrent claims, worker crash, lease expiry, duplicate publish, broker outage, dead-letter behavior, consumer idempotency, authorization, replay, and shutdown.
- Add metrics/alerts for backlog count, oldest pending age, publish latency, retries, dead-letter count, lease expiry, and consumer lag.
- Define retention, backup, encryption, regional replication, and disaster-recovery policies.

This is not a production realtime service until the domain producers, consumers, operational controls, and multi-instance failure tests are complete.
