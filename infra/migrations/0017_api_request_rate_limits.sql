-- Shared API request quotas across all application instances.
-- Keys are HMAC digests; raw IPs and bearer tokens are never persisted.
CREATE TABLE IF NOT EXISTS api_request_rate_limits (
  scope text NOT NULL CHECK (scope IN ('ip', 'route', 'auth', 'session')),
  key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key_hash)
);
CREATE INDEX IF NOT EXISTS api_request_rate_limits_updated_idx
  ON api_request_rate_limits(updated_at);
