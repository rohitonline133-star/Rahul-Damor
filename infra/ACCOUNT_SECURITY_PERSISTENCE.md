# Account security persistence boundary

This slice adds PostgreSQL persistence primitives for account two-factor credentials,
one-time backup codes, and password-recovery challenges. It does not yet connect the
legacy Express endpoints.

## Security contract
- TOTP secrets must be encrypted by the application using authenticated encryption
  before persistence. Store the nonce, authentication tag, ciphertext and key version;
  never persist the plaintext seed or encryption key.
- Backup codes are stored as SHA-256/HMAC digests only and consumed atomically.
- Recovery OTP digests must be HMAC-SHA256 using a server-side pepper of at least
  32 characters. The pepper must not be stored in PostgreSQL or committed to source.
- Recovery challenges are row-locked, attempt-limited, expiring and single-use.
- Callers must execute repository mutations in a transaction and must not send a
  recovery code until challenge creation commits. Delivery provider integration,
  rate limiting, key rotation, TOTP validation, and HTTP route integration remain
  separate required work.

## Production gate
The presence of these tables is not evidence that 2FA or recovery is enabled in the
application. Legacy JSON routes remain authoritative until a tested route cutover,
compatibility migration and rollback plan are completed.

## Phone OTP pepper requirement

The phone-verification repository computes the challenge digest with HMAC-SHA-256 using an application-side pepper of at least 32 characters plus the per-challenge random salt. The pepper is passed explicitly to both challenge creation and code verification; it must be loaded from a secret manager or protected runtime secret, never stored in PostgreSQL, committed to source control, or logged. Rotation requires a planned overlap/version strategy for outstanding challenges. The HTTP routes and SMS delivery adapter are not yet wired to this repository, so this control is not active for production registration/login until that integration and its end-to-end tests are complete.
