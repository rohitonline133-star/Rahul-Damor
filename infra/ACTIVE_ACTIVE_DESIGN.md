# GB Official Active-Active Reference Design

**Status:** engineering design; not a deployment manifest. No regions, clusters, databases, or capacity are provisioned by this document.

## 1. Scale objective and honest capacity model

The long-term objective is to support 10 billion registered accounts. Registered accounts are not equivalent to daily active users, peak concurrent users, or peak requests per second. Do not size infrastructure from the account count alone.

For each workload, calculate:

- Peak concurrent sessions by region and time window.
- Requests per second by endpoint and operation type.
- Read/write ratio, fan-out, payload size, and tail-latency objective.
- Media ingest, transcoding, storage growth, CDN egress, and cache hit ratio.
- Queue throughput, consumer lag, database IOPS, and replication lag.
- Per-account storage and retention requirements.

Use measured workload traces to calculate capacity. For a regional evacuation, surviving regions must have tested spare capacity for the traffic they are expected to absorb. Publish no user-capacity claim without hardware/software inventory, test duration, workload mix, p50/p95/p99 latency, error rate, saturation signals, and recovery results.

## 2. Logical topology

1. Global traffic steering sends users to healthy regional edges using health and latency signals.
2. Each region has redundant ingress/load balancers and multiple stateless API replicas.
3. Realtime gateways are horizontally scaled; connection state and fan-out are externalized to a shared regional event layer.
4. Background workers are isolated by workload: media, feed ranking, notifications, search indexing, moderation, and billing.
5. Object storage is versioned and replicated with explicit retention and recovery policies; media is delivered through a CDN.
6. Data is partitioned by ownership key and workload. Each partition has an authoritative write owner, replicas, and a documented recovery point/objective.
7. Global observability collects metrics, logs, traces, synthetic probes, deployment events, and SLO burn alerts.

This is a logical topology. Select actual locations, networking, database products, and hardware only after workload, legal/data-residency, reliability, and cost reviews.

## 3. Active-Active write model

Active-Active means more than running API instances in two locations. It requires explicit write ownership, consistency, routing, and failure semantics.

- **Compute:** multiple regions can serve traffic simultaneously.
- **Partition ownership:** each mutable entity or shard has one authoritative writer at a time. Route writes to its owner region.
- **Reads:** serve from local replicas only when the feature's consistency contract permits it. Expose replication lag and use read-your-writes routing where required.
- **Ownership transfer:** use a fenced lease/epoch and a quorum-backed control plane. A region that loses ownership must be unable to continue writing. Never rely on DNS changes alone to prevent split-brain.
- **Idempotency:** every retryable command carries a durable idempotency key; consumers record processed event IDs.
- **Ordering:** guarantee ordering only within the entity/partition that requires it, not globally.
- **Conflict handling:** define domain-specific merge/rejection rules. Do not use last-write-wins for balances, ownership, credentials, or security state.

### Data-domain consistency policy

| Domain | Initial policy |
|---|---|
| Authentication, credentials, account ownership | Strong consistency; fenced authoritative write |
| Payments, orders, subscriptions, ledger | Strong consistency; transactional commit and immutable audit trail |
| Group membership, roles, permissions | Strong consistency for authorization decisions |
| Messages, reactions, follows, feed events | Partitioned ownership; idempotent events; documented eventual replication |
| Presence and typing indicators | Ephemeral, regional, TTL-based; loss on failover acceptable if product-approved |
| Media blobs | Immutable/versioned objects with asynchronous multi-region replication |
| Search and recommendations | Rebuildable derived data; asynchronous replication |

A multi-primary database is not automatically safe. Before enabling concurrent writes, prove conflict semantics, quorum behavior, failover fencing, and recovery with fault-injection tests.

## 4. Failure and recovery behavior

- Remove unhealthy instances from regional routing using independent health probes.
- Bound timeouts, retries, exponential backoff, and jitter. Never retry a non-idempotent mutation without an idempotency key.
- Apply circuit breakers, bulkheads, queue limits, backpressure, and controlled load shedding.
- Keep capacity headroom for the largest planned regional evacuation and test it under realistic traffic.
- Define RPO and RTO per data domain; a single global number is insufficient.
- Test node loss, availability-zone loss, regional network partition, database leader loss, event-broker outage, and restoration from backup.
- During network partitions, preserve correctness for strongly consistent operations even if that means temporarily rejecting writes. Do not create two writers to preserve availability.
- Run scheduled restore drills and verify checksums, row counts, event offsets, and application-level invariants.

## 5. Database migration gate

The current application server uses synchronous local JSON persistence. A PostgreSQL environment variable does not create a PostgreSQL adapter. Do not connect a new database and claim migration complete until all request handlers use transactional persistence.

Required sequence:

1. Inventory every entity and access pattern in the current application.
2. Define normalized schema, foreign keys, unique constraints, indexes, retention, and tenant/partition ownership.
3. Implement typed asynchronous repositories and transactions; remove direct mutations of the in-memory JSON object from request handlers.
4. Add versioned, repeatable migrations and migration locks.
5. Build an offline or controlled dual-read migration with immutable source backup, checksums, row counts, referential-integrity checks, and rollback.
6. Test concurrent writes, retries, duplicate requests, transaction aborts, account deletion, and restore.
7. Only then enable production startup and add replicas.

Do not perform unreviewed dual writes to JSON and PostgreSQL; they can diverge.

## 6. Realtime and event backbone gate

The current server's SSE client map is process-local. Multiple API replicas will not share connected clients or presence automatically.

Required sequence:

1. Introduce a broker-backed event publisher/subscriber abstraction.
2. Use durable streams for messages and business events; use ephemeral pub/sub only for transient presence/typing.
3. Use stable event IDs, schema versions, partition keys, consumer idempotency, retry policy, and dead-letter handling.
4. Authenticate each gateway connection and authorize every subscription; never trust a client-supplied user ID.
5. Add reconnect cursors and bounded replay for durable events.
6. Test duplicate delivery, out-of-order delivery, reconnect storms, broker outage, and regional recovery.

The local single-node NATS service in docker-compose is for development only; it is not a multi-region event backbone.

## 7. Security and operations gates

- Store credentials in a secret manager; never commit secrets or expose them in logs.
- Use workload identity, least privilege, key rotation, TLS, encryption at rest, and audited administrative access.
- Separate control plane, data plane, and management networks.
- Define data residency, retention, deletion, backup encryption, and access policy before choosing regions.
- Maintain incident response, on-call ownership, change approval, rollback, and disaster communication procedures.
- Monitor SLOs, saturation, queue lag, replication lag, database connection pools, error budgets, and cost per workload.

## 8. Delivery phases and acceptance criteria

| Phase | Deliverable | Exit criteria |
|---|---|---|
| 0 | CI and local dependency validation | CI runs on this branch; tests, typecheck, build, Compose validation pass |
| 1 | Transactional PostgreSQL persistence | All entities migrated; integration tests; backup/restore and rollback verified |
| 2 | Stateless API and realtime broker | No process-local correctness state; multi-replica tests pass |
| 3 | First production region | Deployment, secrets, observability, security review, restore drill |
| 4 | Second region, active compute | Traffic served in both regions; partition ownership and fencing tested |
| 5 | Regional failover | Controlled evacuation and recovery meet domain-specific RPO/RTO |
| 6 | Scale qualification | Staged load and fault tests support a measured capacity statement |
| 7 | Expansion toward 10B registered accounts | Repeated capacity qualification as usage, geography, and workloads grow |

A phase is not complete because its configuration file exists. Require test evidence and an operator sign-off.

## 9. Current repository limitations

- `server.ts` currently uses local JSON persistence and in-memory SSE connection state.
- Production startup is intentionally blocked until PostgreSQL persistence is implemented.
- `infra/docker-compose.yml` starts one local PostgreSQL, Redis, and NATS instance.
- There are no production multi-region manifests, provisioned clusters, global traffic routes, database replication topology, or regional failover tests in this branch at the time this design was written.

## 10. Immediate engineering backlog

1. Design and review the complete PostgreSQL schema and migration plan from the existing `DbSchema`.
2. Refactor server handlers to asynchronous repositories in small, reviewable slices with compatibility tests.
3. Add PostgreSQL integration-test service to CI and test migrations from a representative legacy fixture.
4. Replace process-local SSE fan-out with broker-backed delivery and test multi-instance behavior.
5. Add operational health/readiness endpoints and structured metrics without exposing secrets or personal data.
6. Choose a region/data-residency plan and deployment target only after explicit infrastructure approval.
7. Build reproducible failure and load-test harnesses before any public capacity statement.

## Non-goals

This document does not create physical servers, purchase infrastructure, provision cloud resources, deploy production services, guarantee uptime, or prove support for 10 billion accounts.
