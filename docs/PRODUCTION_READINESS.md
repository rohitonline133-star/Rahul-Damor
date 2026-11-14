# Production readiness and deployment gates

This repository is not currently safe to deploy as a production messaging service. The server still reads and writes a local JSON database synchronously. A `DATABASE_URL` variable alone does not enable PostgreSQL; no PostgreSQL adapter or transactional migrations are wired into the request handlers yet.

## Current safeguards

- The feature branch no longer seeds demo accounts or demo content on startup.
- Existing JSON data is normalized without inserting sample records.
- An unreadable JSON database causes startup to fail instead of silently replacing it with an empty database.
- Production startup deliberately fails closed until the PostgreSQL migration is implemented.
- Runtime database files are ignored by Git.
- OAuth, SMS, payment, push, and TURN credentials must be configured in the hosting provider's secret manager, never committed to Git or pasted into chat.

## Required engineering work before enabling production

1. Implement a PostgreSQL data-access layer and schema migrations for every current entity (users, sessions, conversations, messages, groups, communities, posts, reports, orders, transactions, devices, notifications, OAuth links, and OTP records).
2. Replace synchronous in-memory mutations with awaited transactional repository operations. Add constraints and indexes for unique identities, membership, ownership, idempotency, and lookup paths.
3. Build a tested, resumable JSON-to-PostgreSQL migration with backup, row-count checks, integrity checks, and rollback procedure. Never overwrite the only copy of user data.
4. Add integration tests against an isolated PostgreSQL instance, including concurrent updates, failed transactions, account deletion, OTP replay/expiry, and session revocation.
5. Configure real provider apps and callback URLs for Google and Meta. Verify token audience/app binding, state/nonce, redirect URI, account linking, and failure paths with provider-issued test credentials.
6. Configure Twilio sender and approved destination numbers; verify rate limits, purpose binding, expiry, one-time use, delivery failures, and abuse monitoring using real test SMS.
7. Complete payment operations around the Razorpay integration: configure test/live keys and the `payment.captured` webhook in the hosting/provider dashboards; add PostgreSQL-backed idempotency and transaction durability; implement refunds, disputes, reconciliation, and settlement reporting. The feature branch now creates Razorpay orders server-side for shop purchases and paid subscription checkout, validates checkout HMAC signatures, fetches captured payment details from Razorpay, validates amount/currency/order binding, verifies raw-body webhook signatures, and only then marks shop orders paid or activates a subscription. Client callbacks alone never unlock purchases. The operator must set `RAZORPAY_PRO_AMOUNT_PAISE` and `RAZORPAY_BUSINESS_AMOUNT_PAISE` after approving plan prices; checkout stays disabled if those values are absent or invalid. Live provider testing is still required.
8. Implement WebRTC signaling, authenticated room membership, ICE configuration, TURN credentials with short expiry, call lifecycle cleanup, and real-device network tests. The current call records/status API is not a complete voice/video calling stack.
9. Configure FCM/APNs credentials and test token registration, revocation, delivery, notification privacy, and retry behavior.
10. Run browser and physical-device end-to-end tests, dependency/security scans, backup-restore drills, and an independent security review.

## Git history and existing database file

The feature branch removes the tracked runtime database file, but merging that deletion does not erase earlier Git history or copies in forks, caches, artifacts, or clones. Before history rewriting, identify whether the old file contained credentials, password hashes, session tokens, phone numbers, or other personal data. Rotate potentially exposed secrets and invalidate sessions first. History cleanup requires coordinated approval because it rewrites shared Git history.

## Credential checklist

`.env.example` lists variable names as planning placeholders. A variable being listed there does not mean its provider integration is implemented or enabled. Store real values only in the deployment platform's secret manager and provider dashboards.
