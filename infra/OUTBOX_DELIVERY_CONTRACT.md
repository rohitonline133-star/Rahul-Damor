# Transactional outbox delivery contract

**Status:** design contract only. No dispatcher, broker publisher, worker lease, or production event delivery is implemented by this document.

## Why this is required

The current application handlers do not insert rows into `event_outbox`. The table in `0001_core.sql` is only a schema foundation. A broker connection by itself cannot make application events reliable: the domain mutation and outbox insert must commit in the same PostgreSQL transaction.

## Required producer contract

1. Validate the command and authorize the actor before changing state.
2. In one database transaction, apply the domain mutation and insert an outbox row.
3. Use a stable event ID, aggregate type/ID, event type, schema version, and partition key.
4. Store only the minimum event payload needed by consumers. Do not put passwords, bearer tokens, OTPs, payment credentials, or raw authentication secrets in events.
5. Commit before acknowledging success to the caller.
6. Enforce idempotency at the command boundary and at each consumer. A retry must not duplicate a message, payment, membership change, or notification.

## Required dispatcher contract

The eventual dispatcher must:

- Claim bounded batches with row-level locking and `FOR UPDATE SKIP LOCKED`.
- Use a renewable, expiring claim lease with a unique worker identity and monotonically increasing fencing token; never hold a database transaction open while waiting on network I/O.
- Publish with the stable outbox event ID as the broker message ID and partition by the domain ordering key.
- Treat delivery as **at least once**, not exactly once. A crash after broker acknowledgement but before marking the row published can cause redelivery.
- Mark a row published only after the broker confirms durable acceptance.
- Retry transient errors with bounded exponential backoff and jitter.
- Move poison events to a restricted dead-letter workflow after a configurable attempt limit; retain the original event ID and failure metadata, but do not log sensitive payloads.
- Expose oldest-pending age, backlog count, publish latency, retries, dead-letter count, and lease expiry metrics.
- Apply backpressure and stop claiming work when broker health or downstream lag exceeds configured limits.

## Required consumer contract

- Validate event type and schema version before processing.
- Persist a processed-event receipt in the same transaction as the consumer's domain side effect.
- Reject or quarantine unsupported schema versions; never silently reinterpret payloads.
- Preserve per-aggregate ordering where the domain requires it. Do not promise global ordering.
- Support bounded replay from a durable cursor and safe restart after a crash.
- Authorize subscriptions server-side; a client-supplied user ID is never an authorization credential.

## Schema and implementation gates

Before implementing the dispatcher, add a versioned migration for claim lease fields, attempt timestamps, last safe error code, and dead-letter state. Add constraints and partial indexes for claimable rows. The migration runner must discover and apply ordered migration files with immutable checksums under one advisory lock.

Before production use, implement and test:

- atomic domain-write + outbox insertion;
- two concurrent dispatchers claiming without duplicate active ownership;
- crash after publish but before acknowledgement persistence;
- lease expiry and stale-worker fencing;
- duplicate and out-of-order delivery;
- broker outage, retry exhaustion, and dead-letter replay;
- consumer idempotency and authorization;
- multi-instance and regional recovery behavior.

## Explicit non-claims

This contract does not connect NATS, implement a worker, change application routes, or make realtime delivery production-ready. The existing in-memory SSE registry remains single-process state until separately replaced and tested.
