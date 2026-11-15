# PostgreSQL application cutover execution plan

**Status:** engineering execution plan; not an implementation or production-readiness claim.
**Branch:** `feature/gb-global-infrastructure`

## 1. Scope and non-negotiable rules

The JSON store currently backs application routes synchronously. PostgreSQL must become the sole authoritative store only after every route has moved to typed asynchronous repositories and the data import has passed integrity checks. Do not introduce a partial dual-write mode.

- Keep production startup fail-closed until the cutover gates in this document are met.
- Never import active session tokens, password-reset tokens, or pending OTP codes.
- Store only hashes of session/reset/verification bearer tokens. Encrypt TOTP seeds and other recoverable secrets with managed key rotation.
- Use parameterized SQL, explicit authorization predicates, bounded queries, and transactions for multi-row invariants.
- Keep payment provider credentials and raw card/bank credentials out of the application database and event payloads.
- Preserve stable legacy IDs during migration where safe; reject duplicate IDs rather than silently overwriting.
- Treat the 10-billion registered-account objective as a long-term design target, not a measured capacity claim.

## 2. Domain-to-relational mapping backlog

Names below are proposed target table groups. Final DDL must be derived from the complete runtime write/read paths and entity types, not only this inventory.

| Legacy collection | Proposed relational tables | Critical invariants |
|---|---|---|
| users | accounts, account_profiles, account_privacy, account_roles | normalized unique username/email/phone; private fields not exposed by public queries |
| conversations | conversations, conversation_members, conversation_permissions | membership uniqueness; owner/admin authorization; community link integrity |
| messages | messages, message_attachments, message_reactions, message_receipts | sender must be member; stable ordering key; idempotent message creation |
| statuses | statuses, status_viewers, status_audience | expiry and audience checks; viewer uniqueness |
| communities | communities, community_members, community_announcements | unique membership; role-gated moderation |
| calls | calls, call_participants, call_events | participant authorization; bounded event retention |
| reports | moderation_reports, moderation_actions | reporter/target references; restricted staff access and audit trail |
| notifications | notifications, notification_receipts | recipient-scoped reads; idempotent event creation |
| posts | posts, post_media, post_likes, post_comments, post_saves, post_poll_options, post_poll_votes | author and audience checks; unique likes/saves/votes |
| channels | channels, channel_members, channel_moderators, channel_posts, channel_post_reactions | owner/moderator permissions; subscriber privacy |
| followers | follows | unique follower/following pair; no self-follow |
| follow_requests | follow_requests | unique pending pair; state transition validation |
| verification_requests | verification_requests, verification_documents | private document access; reviewer audit |
| blocked_users | user_blocks | unique directed pair; reciprocal privacy checks at query time |
| muted_users | user_mutes | unique directed pair; mute is not authorization |
| location_shares | location_shares, location_share_recipients | recipient authorization; mandatory expiry; minimal retention |
| shop_products | shop_products, shop_product_media, shop_inventory | non-negative price/stock; seller ownership |
| shop_cart | carts, cart_items | unique user/product; bounded quantity; server-side price calculation |
| shop_orders | shop_orders, shop_order_items, order_status_history, shipping_addresses | immutable order price snapshot; ownership and transition rules |
| payment_methods | payment_method_refs | provider token/reference only; never store raw PAN/CVV/UPI PIN |
| transactions | payment_transactions, payment_webhook_receipts | provider signature validation; unique provider event/order id; immutable ledger |
| subscriptions | subscriptions, subscription_entitlements, subscription_events | verified provider state; idempotent renew/cancel transitions |
| devices | user_devices | owner-scoped listing/revocation; no trust based solely on device metadata |
| custom_lists | user_lists, user_list_members | owner-scoped CRUD; unique member per list |
| broadcast_lists | broadcast_lists, broadcast_recipients | owner-scoped access; recipient privacy |
| phone_verifications | verification_challenges, verification_attempts | never import active OTPs; hash challenge token; attempt limits and expiry |
| sessions | auth_sessions, session_revocations | never import active sessions; hash token; expiry and global revocation |
| security_logs | security_audit_events | append-only; redact secrets; restricted access |
| security_notifications | security_notifications, notification_receipts | owner-scoped; idempotent creation |
| two_factor_auth | account_mfa_methods, mfa_recovery_codes | encrypt TOTP seed; hash recovery codes; key rotation and replay prevention |
| oauth_accounts | oauth_identities | unique provider/subject; validate issuer/audience; no client-secret storage |
| password_resets | password_reset_challenges | never import tokens; hash token; one-time use and expiry |

## 3. Implementation sequence

### Phase A — schema completeness
1. Trace every read and write of all 32 legacy collections in `server.ts` and client API contracts.
2. Record field nullability, nested structures, lifecycle transitions, uniqueness rules, retention, and access-control predicates.
3. Add ordered, immutable SQL migrations for each bounded domain; add foreign keys, check constraints, unique indexes, query indexes, and migration tests.
4. Add schema-to-TypeScript mapping types and repository interfaces. Do not expose generic untyped JSON CRUD as the permanent interface.

**Exit gate:** every persisted field has an owner, type, validation rule, retention rule, and target table/column or documented deliberate omission.

### Phase B — repository and route conversion
1. Implement repositories for accounts/auth first, then conversations/messaging, social content, communities/channels, commerce/payments, and moderation/settings.
2. Convert route handlers to async/await and typed repository methods. Keep authorization in the server layer and include actor/tenant predicates in sensitive writes.
3. Put each multi-record state change in one transaction; add command idempotency for retries.
4. Replace process-local correctness state (sessions, OTP attempts, rate limits, SSE tickets, presence) with shared stores or explicitly scoped ephemeral services.
5. Keep the production startup guard enabled until no request path reads or writes the JSON document.

**Exit gate:** static search and runtime tests show no request-handler access to legacy `db.<collection>`; all critical operations pass PostgreSQL integration tests.

### Phase C — controlled legacy import
1. Take a read-only source snapshot and encrypted backup under an approved retention policy.
2. Run the metadata-only audit; generate a manifest containing source hash, byte count, per-collection counts, and duplicate/unknown-key findings.
3. Import in bounded, restartable transactions using stable IDs and deterministic conflict rules.
4. Exclude sessions, password-reset tokens, and active phone OTP challenges. Re-enrol MFA where secrets cannot be safely decrypted and re-encrypted.
5. Verify source-to-target counts, uniqueness, foreign-key integrity, balances/order totals, membership counts, and sampled domain invariants.
6. Perform a restore rehearsal and documented rollback rehearsal before cutover.

**Exit gate:** signed-off manifest, verified backup, reproducible import, zero unexplained count/reference mismatches, and tested rollback.

### Phase D — reliable events and distributed realtime
1. Insert outbox events in the same transaction as domain mutations.
2. Implement bounded dispatcher claims using row locks, expiring leases, and fencing tokens; never hold DB transactions open during broker I/O.
3. Publish to NATS with stable event IDs and partition keys. Delivery is at-least-once; consumers must persist idempotency receipts with side effects.
4. Replace process-local SSE routing with authenticated broker-backed fanout, bounded queues, reconnect cursors, and authorization on every subscription.
5. Test duplicate delivery, reordering, broker outage, worker crash, stale lease, dead-letter replay, reconnect, and multi-instance fanout.

**Exit gate:** multi-instance integration tests prove authorization, no lost committed events, safe duplicate handling, bounded memory/queues, and recoverable replay.

### Phase E — multi-region qualification
1. Define per-entity consistency and ownership. Use a single fenced writer per strongly consistent partition; do not allow independent active writers for the same entity without a proven conflict protocol.
2. Validate replication lag, quorum/control-plane loss, stale-owner fencing, region isolation, and failover/recovery.
3. Run backup restoration, disaster-recovery, security, and staged workload tests with measured RPO/RTO and capacity.
4. Enable production startup only after a reviewed canary and rollback plan.

**Exit gate:** measured regional failover and recovery evidence, reviewed security controls, and capacity tests under a documented workload model.

## 4. Required integration and failure tests

- Auth: registration races, unique identifier conflicts, password verification, session rotation/revocation, reset one-time use, OTP throttling, MFA replay protection.
- Groups/communities: role matrix, owner transfer, membership removal, community-linked group permissions, concurrent admin changes.
- Messaging: duplicate send idempotency, member authorization, ordering, read receipts, attachment authorization, reconnect replay.
- Social: private-account audience enforcement, follow request races, block/mute interactions, post likes/saves/comments/poll vote uniqueness.
- Commerce: inventory race/oversell prevention, immutable order totals, webhook signature and replay checks, idempotent payment state transitions.
- Operations: pool exhaustion, transaction rollback, migration checksum mismatch, broker outage, worker crash, stale lease fencing, region isolation, backup restore.

## 5. Current verified state and explicit blockers

Existing work provides local PostgreSQL/Redis/NATS Compose services, additive foundational migrations for accounts, sessions, conversations, messages, posts, follows, outbox, idempotency, partition ownership, groups, communities, notifications, join requests, profiles, privacy settings, blocks, mutes, follow requests, statuses/views, moderation reports, devices and preferences; a checksum-verified ordered migration runner; a metadata-only legacy JSON audit; an outbox dispatcher; and CI coverage for Compose validation, migrations, unit tests, TypeScript, and build. These are persistence primitives, not proof that all application routes use them.

It does **not** yet provide the complete relational schema, repository conversion, production data import, transactional outbox producers, NATS dispatcher/consumers, shared realtime state, regional database topology, provisioned compute/network/storage, or measured global capacity. Local Compose is a development aid, not a production HA cluster.

No claim of 10-billion-account readiness is valid until workload assumptions, concurrency, read/write rates, media throughput, storage growth, replication costs, and measured failover/load tests are available.


## Commerce schema batch

Migration `0012_commerce_persistence.sql` now provides relational persistence primitives for products, carts, orders, order-line snapshots, opaque payment-provider references, transactions, subscriptions, and idempotent webhook receipts. See `infra/COMMERCE_PERSISTENCE_BOUNDARY.md`. Legacy commerce routes and data are not yet migrated; provider configuration and verified webhook integration remain required.
