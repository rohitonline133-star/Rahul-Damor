-- Persistent second-factor credentials and one-time recovery challenges.
-- TOTP secrets must be encrypted by the application before they are passed here.
-- Backup codes and recovery codes are stored only as keyed digests.
CREATE TABLE IF NOT EXISTS account_two_factor (
  user_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  secret_ciphertext text NOT NULL,
  secret_nonce text NOT NULL,
  secret_auth_tag text NOT NULL,
  encryption_key_version text NOT NULL,
  enabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(secret_ciphertext) BETWEEN 1 AND 4096),
  CHECK (secret_nonce ~ '^[a-f0-9]{24}$'),
  CHECK (secret_auth_tag ~ '^[a-f0-9]{32}$'),
  CHECK (length(encryption_key_version) BETWEEN 1 AND 64)
);
CREATE TABLE IF NOT EXISTS account_two_factor_backup_codes (
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  PRIMARY KEY (user_id, code_hash)
);
CREATE INDEX IF NOT EXISTS account_two_factor_backup_unused_idx
  ON account_two_factor_backup_codes(user_id, created_at)
  WHERE consumed_at IS NULL;
CREATE TABLE IF NOT EXISTS password_recovery_challenges (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  code_salt text NOT NULL CHECK (code_salt ~ '^[a-f0-9]{32}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS password_recovery_user_recent_idx
  ON password_recovery_challenges(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS password_recovery_one_active_idx
  ON password_recovery_challenges(user_id)
  WHERE consumed_at IS NULL;
