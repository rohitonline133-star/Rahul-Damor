# GB Official Global Infrastructure

## Scope and honest capacity statement

This directory is the infrastructure foundation and architecture plan for GB Official. It is **not** a deployed 10-billion-user system. Ten billion registered accounts is a long-term design target; capacity must be established through workload models, benchmarks, regional failure tests, and measured production telemetry.

The local Compose stack is for developer integration only. It runs one PostgreSQL instance, one Redis instance, and one NATS instance. It does not provide high availability, geographic redundancy, automatic regional failover, or production-grade security.

## Target topology

- Global DNS / anycast edge routes users to healthy regions.
- Each region runs multiple stateless API and realtime gateway replicas behind regional load balancers.
- Separate worker pools process media, notifications, feeds, search indexing, and moderation asynchronously.
- Media is stored in replicated object storage and distributed through a CDN.
- Data is partitioned by tenant/user key and workload. Each shard has a documented replication and recovery policy.
- A durable event backbone carries versioned events; consumers are idempotent and support retries and dead-letter handling.
- Observability is global: metrics, logs, traces, SLOs, synthetic checks, and capacity alerts.

## Active-active and data safety

Active-active is a system property, not a Docker Compose setting. Before enabling writes in multiple regions, choose a consistency model per data domain:

- Strongly consistent transactions (for example payments, account ownership, and security settings) require a single-writer shard/consensus strategy or a database with proven multi-region transaction semantics.
- Social interactions can often use partitioned ownership, idempotency keys, event ordering per entity, and asynchronous replication with explicit conflict handling.
- Media blobs should be immutable/versioned and replicated independently from metadata.
- Never acknowledge a critical write until its configured durability threshold is met.

Avoid unconstrained multi-primary writes to the same records: they can create split-brain, lost updates, and conflicting account state.

## Failure handling

1. Health-check instances and remove unhealthy nodes from routing.
2. Apply bounded retries with exponential backoff and jitter; never retry non-idempotent writes without an idempotency key.
3. Use circuit breakers, timeouts, bulkheads, queue limits, and load shedding.
4. Keep spare capacity in each region for a regional evacuation; test that capacity instead of assuming it.
5. Define RPO/RTO for every data domain and regularly test restore and regional failover.
6. Degrade optional features safely during overload rather than taking authentication and core reads offline.

## Capacity engineering

Estimate capacity from measured workload, not registered-account count alone. Track daily active users, peak concurrent users, requests/second by endpoint, read/write mix, payload sizes, media egress, queue lag, database IOPS, cache hit rate, and geographic distribution.

Run staged tests at 1x, 2x, and 5x expected peak; then run controlled dependency, node, and region failure exercises. Do not publish a user-capacity claim until results include hardware, software versions, test duration, workload mix, error rate, latency percentiles, and recovery time.

## Production prerequisites

- Select and operate physical machines/data-center facilities or approved infrastructure providers. Software in this repository cannot create physical compute, power, cooling, networking, IP transit, or storage by itself.
- Establish network segmentation, secrets management, key rotation, encryption in transit/at rest, patching, backups, access review, incident response, and audit logging.
- Deploy through reviewed infrastructure-as-code and staged environments.
- Keep credentials out of Git; use secret managers and short-lived workload identities.

## Local development

Run `docker compose -f infra/docker-compose.yml up -d`. This starts local dependencies only. Stop them with `docker compose -f infra/docker-compose.yml down`. Persistent development data is kept in named volumes; `down -v` deletes it.

Before production, replace every local single-instance dependency with a tested highly available deployment and complete a security and operational review.

## Reliable realtime event delivery contract

See [OUTBOX_DELIVERY_CONTRACT.md](./OUTBOX_DELIVERY_CONTRACT.md) for the transactional outbox contract. The branch contains a validated PostgreSQL producer helper and JetStream dispatcher, but application routes do not yet insert events and consumers/realtime fanout are not production-ready.

## Detailed Active-Active design

See [ACTIVE_ACTIVE_DESIGN.md](./ACTIVE_ACTIVE_DESIGN.md) for the consistency model, partition ownership, failure fencing, database migration gates, realtime event architecture, operational requirements, phased acceptance criteria, and honest capacity qualification process. This is a design document, not deployed infrastructure.

## PostgreSQL foundation (development / CI only)

The branch now contains an additive foundational schema at `infra/migrations/0001_core.sql`, an ordered, checksum-verified advisory-lock migration runner (`npm run db:migrate`), and a bounded PostgreSQL pool/transaction helper at `src/server/postgres.ts`.

For local development, set a private local password and start the Compose dependencies:

```sh
export GB_POSTGRES_PASSWORD='use-a-local-development-password'
docker compose -f infra/docker-compose.yml up -d postgres
export DATABASE_URL='postgresql://gb_app:YOUR_LOCAL_PASSWORD@127.0.0.1:5432/gb_official'
export PGSSLMODE=disable
npm run db:migrate
```

Use `PGSSLMODE=disable` only for loopback/local development. The migration runner defaults to TLS certificate verification (`verify-full`) outside local development. Never commit real passwords or database URLs.

**Important migration boundary:** this is a schema and connection/migration foundation, not a completed application data migration. Existing `server.ts` request handlers still read and mutate the local JSON `DbSchema` synchronously. The new PostgreSQL helper is not yet wired into those handlers, legacy JSON records have not been imported, and production startup remains deliberately blocked. Do not run this migration against production data or claim PostgreSQL-backed application operation until the handler/repository refactor, data migration, rollback plan, and integration tests are complete.

CI provisions a disposable PostgreSQL 17 service, applies the migration twice to verify idempotency/checksum handling, then runs unit tests, TypeScript validation, and the production build. CI database credentials are test-only.

## Legacy JSON preflight audit (read-only)

Before designing or running a data import, create a protected backup of the legacy JSON file and run the metadata-only audit:

```sh
npm run db:audit-legacy -- ./data/database.json ./legacy-audit-manifest.json
```

The tool reports a SHA-256 source checksum, byte size, per-collection record counts, duplicate IDs, malformed collection shapes, and unknown top-level keys. It does not print record values or modify the source file. The manifest contains metadata only; store it with the migration evidence, not in a public repository.

Sessions, password-reset tokens, and pending OTP records are marked **never-import**. Two-factor authentication material requires a separately reviewed encryption/key-rotation procedure. The audit is a preflight aid, not a migration or proof of referential integrity. A human-reviewed domain mapping and an independently tested import/rollback tool are still required.


## PostgreSQL cutover execution plan

See [POSTGRES_CUTOVER_EXECUTION_PLAN.md](./POSTGRES_CUTOVER_EXECUTION_PLAN.md) for the collection-to-table mapping backlog, phased repository conversion, safe legacy import/rollback gates, integration tests, outbox/realtime implementation sequence, and multi-region qualification criteria. It is an execution plan; the listed application migration and distributed services are not yet implemented.


## Outbox dispatcher implementation

The branch includes a separately supervised JetStream publisher worker at `scripts/dispatch-outbox.ts`, runnable with `npm run db:dispatch-outbox`. See [OUTBOX_DISPATCHER_OPERATIONS.md](./OUTBOX_DISPATCHER_OPERATIONS.md) for environment, stream contract, retry/dead-letter semantics, and production gates. This worker only delivers rows already written to `event_outbox`; domain routes still need atomic outbox producers and consumers still need idempotency/authorization implementations.
