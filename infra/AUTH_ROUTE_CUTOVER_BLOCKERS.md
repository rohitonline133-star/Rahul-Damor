# Authentication route cutover — verified blockers

Audit target: `feature/gb-global-infrastructure` at commit
`c65a4a435a0564314ee276b71411e12e08f075c7`.

## CI evidence

GitHub Actions run `45024860153` for the target commit completed successfully.
The workflow provisions PostgreSQL 17, applies migrations twice, runs the test
suite, performs the TypeScript check, and creates the production build.
A green CI run is not evidence that production credentials, SMS delivery, or
production deployment are configured.

## Live-route boundary found in `server.ts`

The following handlers still use the legacy JSON database and must not be
described as PostgreSQL-backed:

- `POST /api/auth/phone/send-otp`: applies the PostgreSQL send quota, but
  stores the OTP challenge in `db.phone_verifications` and sends SMS from
  that legacy flow.
- `POST /api/auth/phone/verify-otp`: verifies the JSON record, marks it
  used, and creates a legacy verification token. Phone login also creates
  an in-memory/legacy session.
- `POST /api/auth/phone/complete-registration`: reads and consumes the
  JSON verification token; creates a legacy user, security notification,
  welcome conversation, and legacy session.
- `GET /api/auth/check-username`: checks `db.users`, not PostgreSQL.
- `POST /api/auth/login` and other OAuth/recovery handlers require a
  separate route-by-route audit before cutover.

## Required safe migration order

1. Define and migrate a compatibility profile model before changing account
   creation. The current legacy user object includes avatar, bio, online and
   last-seen state, verification status, privacy settings, blocked-user IDs,
   role, and creation metadata. The current `accounts` repository does not
   persist all of these fields. Do not silently drop them during cutover.
2. Add transactional repository operations for account + profile + welcome
   notification + welcome conversation + session creation. Use the existing
   caller-owned `PoolClient` transaction boundary.
3. Make OTP send create and commit a PostgreSQL challenge before calling
   Twilio. Never hold a database transaction open during the network request.
   If dispatch fails, invalidate the challenge in a separate transaction.
4. Make OTP verify issue the PostgreSQL one-time verification token. Phone
   login must verify the purpose and account existence, then create a
   persistent session in the same transaction as any account-state changes.
5. Make registration atomically consume the verification token and create
   the account, compatibility profile, welcome records, and persistent
   session. Unique constraints, not preflight JSON checks, must arbitrate
   username/email/phone races.
6. Move username availability to PostgreSQL. Treat it as advisory only;
   registration must still enforce uniqueness transactionally.
7. Migrate password login, OAuth linking/callbacks, password recovery,
   logout, session listing/revocation, and authentication middleware. Ensure
   all token lookups use persistent session digests and revoked/expired
   sessions fail closed.
8. Add PostgreSQL-backed route tests for SMS provider failure, OTP expiry,
   replay, wrong-attempt limit, duplicate registration races, transaction
   rollback, session persistence/revocation, and legacy profile parity.
9. Only after all routes and middleware pass parity tests should the
   production startup guard be reconsidered. Do not remove it to bypass the
   migration.

## Release blockers

- Route-level authentication persistence is not complete.
- The legacy profile and welcome-data model has no complete PostgreSQL parity.
- SMS provider credentials and production PostgreSQL are not verified here.
- No production deployment or main-branch merge has been performed.

This document is an audit/cutover plan, not a claim that the listed work is
implemented.
