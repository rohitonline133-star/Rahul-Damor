# Synthetic legacy database fixture

## Purpose

`tests/fixtures/legacy-database.synthetic.json` is a safe, generated **shape scaffold** for exercising the metadata-only legacy JSON auditor. It contains all 32 top-level keys discovered in `server.ts`'s `DbSchema` / `createEmptyDb()`: 29 arrays and 3 object maps.

It is not a copy of a production database, not a complete example of every nested record, and not evidence that the PostgreSQL schema covers these domains. Most array records deliberately contain only a synthetic ID and marker because the legacy `DbSchema` types these collections as `any[]`; their full field contracts must be established from route writes, reads, and existing persisted examples.

## Safety rules

- Every included value is invented and marked `_synthetic`; no real user information is present.
- `sessions`, `phone_verifications`, and `password_resets` are empty. The importer must never carry over live session tokens, pending OTPs, or password-reset tokens.
- `two_factor_auth` is empty. Do not invent or import 2FA secrets; a future migration requires a separately reviewed encrypted-secret and key-rotation design.
- The fixture must only be used in automated tests and local development.
- Never point an importer at production until backup, explicit dry-run review, per-domain mappings, referential-integrity checks, and rollback are proven.

## Collection inventory

| Key | Shape | Fixture status | Mapping status |
|---|---|---|---|
| `users` | array | one generic synthetic record | requires field-level review |
| `conversations` | array | one generic synthetic record | requires field-level review |
| `messages` | array | one generic synthetic record | requires field-level review |
| `statuses` | array | one generic synthetic record | requires field-level review |
| `communities` | array | one generic synthetic record | requires field-level review |
| `calls` | array | one generic synthetic record | requires field-level review |
| `reports` | array | one generic synthetic record | requires field-level review |
| `notifications` | array | one generic synthetic record | requires field-level review |
| `posts` | array | one generic synthetic record | requires field-level review |
| `channels` | array | one generic synthetic record | requires field-level review |
| `followers` | array | one generic synthetic record | requires field-level review |
| `follow_requests` | array | one generic synthetic record | requires field-level review |
| `verification_requests` | array | one generic synthetic record | requires field-level review |
| `blocked_users` | array | one generic synthetic record | requires field-level review |
| `muted_users` | array | one generic synthetic record | requires field-level review |
| `location_shares` | array | one generic synthetic record | requires field-level review |
| `shop_products` | array | one generic synthetic record | requires field-level review |
| `shop_orders` | array | one generic synthetic record | requires field-level review |
| `payment_methods` | array | one generic synthetic record | requires field-level review |
| `transactions` | array | one generic synthetic record | requires field-level review |
| `devices` | array | one generic synthetic record | requires field-level review |
| `custom_lists` | array | one generic synthetic record | requires field-level review |
| `broadcast_lists` | array | one generic synthetic record | requires field-level review |
| `phone_verifications` | array | empty by security policy | requires field-level review |
| `sessions` | array | empty by security policy | requires field-level review |
| `security_logs` | array | one generic synthetic record | requires field-level review |
| `security_notifications` | array | one generic synthetic record | requires field-level review |
| `oauth_accounts` | array | one generic synthetic record | requires field-level review |
| `password_resets` | array | empty by security policy | requires field-level review |
| `shop_cart` | object/map | one synthetic user key with one generic item | requires field-level review |
| `subscriptions` | object/map | one synthetic user key with inactive sample | requires field-level review |
| `two_factor_auth` | object/map | empty by security policy | separate encrypted migration design required |

## Next engineering step

For each collection, derive a typed contract from every route/helper that reads or writes it. Record required fields, optional fields, identifier semantics, foreign-key relationships, privacy classification, retention, and migration policy. Then replace generic scaffold records with domain-valid synthetic records and add PostgreSQL repository/integration tests. Do not infer a field contract solely from the collection name or the `any[]` declaration.
