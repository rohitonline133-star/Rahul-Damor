# PostgreSQL authentication persistence boundary

This module is a database persistence primitive, not a live authentication route.

- Account rows are created with `createAccount`; password derivation and verification remain the responsibility of the authentication service.
- Session bearer tokens are generated with cryptographically secure randomness and stored only as SHA-256 digests in `user_sessions.token_hash`.
- Session lookup rejects malformed tokens before querying and returns only unexpired, non-revoked rows.
- Revocation is persisted in PostgreSQL and can be performed per-session or for all sessions belonging to an account.
- Callers must pass a checked-out `PoolClient` and own transaction boundaries. Account creation plus session creation should share one transaction when registering a user.
- Never log bearer tokens, password hashes, salts, OTP values, or recovery secrets.

## Not yet connected

The current Express authentication routes in `server.ts` still use the legacy JSON store, in-memory active-session map and synchronous handlers. This module is not wired into those routes. Production startup must remain fail-closed until every auth route and middleware path is migrated and parity-tested. The legacy `users` model also contains profile and moderation fields not represented in the current `accounts` table.
