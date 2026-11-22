-- Shared OTP send quotas. Keys are HMAC digests; raw phone/IP/device identifiers are never stored.
CREATE TABLE IF NOT EXISTS otp_send_rate_limits (
  scope text NOT NULL CHECK (scope IN ('phone', 'ip', 'device')),
  key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key_hash)
);
CREATE INDEX IF NOT EXISTS otp_send_rate_limits_updated_idx
  ON otp_send_rate_limits(updated_at);
