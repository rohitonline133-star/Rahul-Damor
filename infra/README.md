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
