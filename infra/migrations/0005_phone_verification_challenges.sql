-- Persistent phone verification challenges. Active OTPs and bearer verification
-- tokens are never stored in plaintext and are never imported from legacy JSON.
CREATE TABLE IF NOT EXISTS verification_challenges (
  id text PRIMARY KEY,
  phone text NOT NULL CHECK (phone ~ '^\\+[1-9][0-9]{7,14}$'),
  purpose text NOT NULL CHECK (purpose IN ('register', 'login', 'authenticate')),
  code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  code_salt text NOT NULL CHECK (code_salt ~ '^[a-f0-9]{32}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  cooldown_until timestamptz NOT NULL,
  request_ip text,
  device_id text,
  verified_at timestamptz,
  verification_token_hash text UNIQUE,
  verification_expires_at timestamptz,
  verification_token_consumed_at timestamptz,
  consumed_at timestamptz,
  superseded_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (cooldown_until >= created_at),
  CHECK ((verified_at IS NULL) = (verification_token_hash IS NULL)),
  CHECK ((verification_token_hash IS NULL) = (verification_expires_at IS NULL))
);
CREATE INDEX IF NOT EXISTS verification_challenges_lookup_idx
  ON verification_challenges(phone, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS verification_challenges_expiry_idx
  ON verification_challenges(expires_at)
  WHERE consumed_at IS NULL AND superseded_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS verification_challenges_one_live_idx
  ON verification_challenges(phone, purpose)
  WHERE consumed_at IS NULL AND superseded_at IS NULL AND verified_at IS NULL;
