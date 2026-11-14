# Authentication/session audit — remaining verification limits

This audit was performed against `feature/gb-official-complete-suite` after commit `5c79f9119a360f3634623799275f2f8aad840d20`.

## Confirmed safeguards
- Session records are persisted before a token is returned; failed persistence removes the new session from both the database array and in-memory token index.
- OTP purpose and code shape are validated by shared unit-tested helpers.
- Google/Facebook/Instagram OAuth token checks include provider/app identity checks described in the production readiness guide.
- Production startup is deliberately blocked while the JSON persistence layer remains in use.

## Remaining code-level issues identified
1. The admin `/api/tests/run` suite in `server.ts` is a legacy, fixture-dependent diagnostic suite, not an isolated integration test suite. Several checks refer to fixed demo IDs such as `user_jordan`, `user_alex`, and fixed conversation IDs. A fresh database has no such fixtures, so those checks cannot be used as a reliable release gate. Some checks only inspect hard-coded in-memory values rather than exercising the route/provider behavior.
2. The diagnostic suite mutates application database state while it runs (for example, test follow relationships and session creation). It should be replaced with isolated tests that use temporary fixtures and guaranteed cleanup before being treated as production evidence.
3. Login and OAuth handlers perform user/profile state changes before session creation. The session helper correctly rolls back its own session on persistence failure, but route-level user/OAuth mutations are not yet consistently wrapped in a single transaction. The PostgreSQL transaction refactor is the correct durable fix; until then, failure-path integration tests are still required.
4. The current unit tests cover validation helpers only. They do not exercise Express routes, persistence failures, concurrent writes, provider callbacks, or real devices.

## Required completion work
- Replace the legacy in-server diagnostics with isolated route/integration tests using disposable database fixtures.
- Introduce a transactional persistence abstraction and move account creation, OAuth linking, session creation, and OTP consumption into atomic transactions.
- Test session creation failure for password login, phone login, registration, and all OAuth providers; assert no partial user/profile/link/session state is left behind.
- Add isolated tests for logout/revocation, session expiry, OTP replay/expiry, and concurrent authentication attempts.
- Run PostgreSQL-backed integration tests after the database adapter and migrations exist.

## Release interpretation
A passing CI run currently proves only that the existing helper unit tests, TypeScript check, and Vite/server production build pass. It does not prove that the legacy admin diagnostic suite passes on an empty database, nor that live authentication providers or production persistence work. Do not enable the production guard until the database and transaction work above is complete.
