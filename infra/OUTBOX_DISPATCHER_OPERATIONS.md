# Outbox dispatcher operations

**Status:** implemented worker code; not production-verified. Application domain routes do not yet call the producer helper, consumers are not implemented, and no regional broker topology is provisioned.

## Required environment

- `DATABASE_URL`: PostgreSQL connection string.
- `NATS_URL`: NATS endpoint for a JetStream-enabled cluster.
- `PGSSLMODE`: defaults to certificate-verifying TLS; set to `disable` only for local loopback development.
- Optional: `OUTBOX_BATCH_SIZE` (default 50, max 500), `OUTBOX_LEASE_MS` (default 30000), `OUTBOX_POLL_MS` (default 500), `OUTBOX_MAX_ATTEMPTS` (default 12).

Run after migrations with `npm run db:dispatch-outbox`. Run it as a separately supervised worker process, not inside each HTTP API process unless one dispatcher per replica is intentionally desired.

## JetStream stream contract

Provision a JetStream stream outside this worker before starting it. The stream must capture subjects matching `gb.events.>`, use file-backed storage and replication appropriate to the environment, and retain messages for the application's documented replay window. Configure the stream's duplicate window to cover expected worker retry delays. The worker uses the stable outbox UUID as the JetStream message ID.

The worker publishes an envelope with event ID, type, schema version, aggregate identity, partition key, occurrence time, and payload. Aggregate and event names are restricted to safe subject tokens. Consumers must still validate schemas, authorize each action, and persist an idempotency receipt with their side effect.

## Delivery and failure semantics

- Claims use `FOR UPDATE SKIP LOCKED`, per-row UUID claim IDs, expiring leases, and conditional updates. A stale worker cannot mark a reclaimed row published.
- JetStream publish acknowledgement is required before marking the outbox row published.
- Delivery is at-least-once. A crash after broker acknowledgement but before the database update can publish again; stable message IDs and idempotent consumers are mandatory.
- Failed publishes release the claim and record only a fixed safe error code. Attempts are bounded. Rows at the limit are marked dead-lettered, including rows whose worker crashed on its final leased attempt.
- The worker does not log event payloads, tokens, user identifiers, or connection strings.
- This worker does not create outbox records. Use `insertOutboxEvent(client, input)` from `src/server/outbox.ts` with the same PostgreSQL transaction/client as the domain mutation. Domain routes have not yet been converted to do this.

## Required production gates

Before enabling production traffic, add integration tests with disposable PostgreSQL and JetStream for concurrent claims, worker crash, lease expiry, duplicate publish, broker outage, dead-letter behavior, consumer idempotency, authorization, replay, and shutdown. Add metrics/alerts for backlog count, oldest pending age, publish latency, retries, dead-letter count, lease expiry, and consumer lag. Define retention, backup, encryption, regional replication, and disaster-recovery policies. Do not treat a local single-node Compose broker as HA.
