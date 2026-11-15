# PostgreSQL authentication persistence boundary

This module contains database persistence primitives, not live authentication routes.

- Account rows are created with `createAccount`; password derivation and verification remain the responsibility of the authentication service.
- Session bearer tokens are generated with cryptographically secure randomness and stored only as SHA-256 digests in `user_sessions.token_hash`.
- Session lookup rejects malformed tokens before querying and returns only unexpired, non-revoked rows. Revocation is persisted in PostgreSQL and can be performed per-session or for all sessions belonging to an account.
- Phone OTP challenges are scoped by E.164 phone and purpose, expire, enforce bounded attempts, and store an HMAC digest rather than the OTP.
- Successful OTP verification issues a short-lived random verification token; only its SHA-256 digest is stored. The token is purpose-scoped and can be consumed once.
- Challenge creation, verification, token consumption, account creation, and session creation must run on a checked-out `PoolClient` inside caller-owned transactions. Do not hold a transaction open while calling an SMS provider: create/commit the challenge first, dispatch the returned code, and invalidate it in a separate transaction if delivery fails.
- Never log bearer tokens, password hashes, salts, OTP values, or recovery secrets.

## Not yet connected

The current Express authentication routes in `server.ts` still use the legacy JSON store, in-memory active-session map, and synchronous handlers. The OTP repository is not wired into those routes; SMS delivery, recovery, MFA, rate limits, and security audit persistence remain separate migration work. The legacy `users` model also contains profile and moderation fields not represented in the current `accounts` table. Production startup must remain fail-closed until every auth route and middleware path is migrated and parity-tested.
