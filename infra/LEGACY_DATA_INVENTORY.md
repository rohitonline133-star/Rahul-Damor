# Legacy JSON persistence inventory and PostgreSQL cutover plan

## Audit snapshot

Branch audited: `feature/gb-global-infrastructure`.

The current `server.ts` is 6,775 lines and contains approximately 394 direct `db.<collection>` references across 32 top-level collections/maps. The request handlers synchronously read and mutate a process-local JSON document. This is not safe to replace with a thin connection switch: route handlers, authorization checks, multi-record updates, session handling, and realtime notifications all depend on synchronous in-memory state.

The inventory below is derived from the current `DbSchema` interface and its `createEmptyDb()` initializer. It is a migration checklist, not a claim that the current SQL schema covers these entities.

## Legacy collections

| Legacy key | Shape | Migration status |
|---|---|---|
| users | array | Not migrated; foundational `accounts` table is only a partial mapping |
| conversations | array | Not migrated; foundational `conversations` table is only a partial mapping |
| messages | array | Not migrated; foundational `messages` table is only a partial mapping |
| statuses | array | Not migrated |
| communities | array | Not migrated |
| calls | array | Not migrated |
| reports | array | Not migrated |
| notifications | array | Not migrated |
| posts | array | Not migrated; foundational `posts` table is only a partial mapping |
| channels | array | Not migrated |
| followers | array | Not migrated; foundational `follows` table is only a partial mapping |
| follow_requests | array | Not migrated |
| verification_requests | array | Not migrated |
| blocked_users | array | Not migrated |
| muted_users | array | Not migrated |
| location_shares | array | Not migrated |
| shop_products | array | Not migrated |
| shop_cart | object/map | Not migrated |
| shop_orders | array | Not migrated |
| payment_methods | array | Not migrated |
| transactions | array | Not migrated |
| subscriptions | object/map | Not migrated |
| devices | array | Not migrated |
| custom_lists | array | Not migrated |
| broadcast_lists | array | Not migrated |
| phone_verifications | array | Not migrated; pending OTP data must not be imported |
| sessions | array | Not migrated; persisted sessions are deliberately revoked at startup |
| security_logs | array | Not migrated |
| security_notifications | array | Not migrated |
| two_factor_auth | object/map | Not migrated; secrets require dedicated encrypted storage and rotation |
| oauth_accounts | array | Not migrated |
| password_resets | array | Not migrated; reset tokens must not be imported |
 
## Required cutover work

1. Freeze and document the complete legacy JSON shape for every collection, including nested fields and identifiers.
2. Design normalized PostgreSQL tables, constraints, indexes, retention rules, and ownership/region keys for every domain. Do not treat a generic JSONB dump as a substitute for domain constraints.
3. Introduce typed asynchronous repositories. Preserve authorization checks and make multi-record operations transactional.
4. Refactor every route and helper to use repositories; remove all direct synchronous `db.*` reads/writes and process-local assumptions that affect correctness.
5. Move authentication sessions, OTP verification, password resets, rate limits, and two-factor secrets to shared, appropriately protected storage. Hash bearer tokens at rest and encrypt high-sensitivity secrets.
6. Add a one-time, offline import tool that validates source JSON, emits a backup and checksum manifest, imports in bounded transactions, and verifies per-table row counts, unique keys, references, and domain invariants. Never import live sessions, OTPs, or password-reset tokens.
7. Add rollback and restore drills. Do not dual-write to JSON and PostgreSQL without a tested reconciliation protocol.
8. Add PostgreSQL-backed integration tests for registration/login, recovery, sessions, groups/communities, permissions, messaging, posts, commerce/payments, notifications, and concurrent updates.
9. Only after all gates pass, remove the production startup block and deploy through staged canary rollout.

## Realtime and multi-region dependency

The current SSE client registry and SSE tickets are in-process maps. Multiple API replicas will not share connections or rate-limit state. Before horizontal or multi-region rollout, implement authenticated cross-instance event distribution, durable event delivery, consumer idempotency, reconnect cursors, bounded queues, and failure tests. The transactional outbox schema is a foundation only; application mutations do not yet write outbox records.

## Acceptance gates

- No direct synchronous JSON persistence remains in request handlers.
- All production-critical domain state has a documented PostgreSQL schema and migration.
- Legacy import has reproducible checksums, counts, integrity checks, backup, and rollback evidence.
- Integration tests pass against disposable PostgreSQL and multi-instance realtime tests.
- Session, OTP, reset, rate-limit, and 2FA state is shared and secure across replicas.
- Regional failover, fencing, backup restoration, and load tests have measured results.
- Production startup is enabled only after the above gates are reviewed and passed.

**Current status:** inventory documented; PostgreSQL foundation and CI migration test exist; application persistence cutover, data import, distributed realtime, multi-region deployment, and capacity qualification remain incomplete.
