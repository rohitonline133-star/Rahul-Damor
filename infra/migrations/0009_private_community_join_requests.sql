-- Private-community join requests and explicit moderation decisions.
CREATE TABLE IF NOT EXISTS community_join_requests (
  community_id text NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text REFERENCES accounts(id) ON DELETE SET NULL,
  PRIMARY KEY (community_id,user_id),
  CHECK ((status='pending' AND reviewed_at IS NULL) OR
         (status<>'pending' AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS community_join_requests_queue_idx
  ON community_join_requests(community_id,requested_at)
  WHERE status='pending';
CREATE INDEX IF NOT EXISTS community_join_requests_user_idx
  ON community_join_requests(user_id,requested_at DESC);
