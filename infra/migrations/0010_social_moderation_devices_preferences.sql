-- Additional durable social, moderation, device and preference primitives.
-- This is additive schema groundwork; legacy API routes are not switched by this migration.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  avatar_url text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '' CHECK (length(bio)<=2000),
  website_url text,
  is_private boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  user_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  last_seen_visibility text NOT NULL DEFAULT 'everyone' CHECK(last_seen_visibility IN ('everyone','contacts','nobody')),
  profile_photo_visibility text NOT NULL DEFAULT 'everyone' CHECK(profile_photo_visibility IN ('everyone','contacts','nobody')),
  status_visibility text NOT NULL DEFAULT 'everyone' CHECK(status_visibility IN ('everyone','contacts','selected')),
  read_receipts_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  blocked_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(blocker_id,blocked_id),
  CHECK(blocker_id<>blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks(blocked_id,blocker_id);
CREATE TABLE IF NOT EXISTS user_mutes (
  muter_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  muted_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(muter_id,muted_id),
  CHECK(muter_id<>muted_id)
);
CREATE TABLE IF NOT EXISTS follow_requests (
  id text PRIMARY KEY,
  requester_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(requester_id,target_user_id),
  CHECK(requester_id<>target_user_id),
  CHECK((status='pending' AND reviewed_at IS NULL) OR (status<>'pending' AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS follow_requests_inbox_idx ON follow_requests(target_user_id,created_at DESC) WHERE status='pending';
CREATE TABLE IF NOT EXISTS user_statuses (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status_type text NOT NULL CHECK(status_type IN ('text','image','video')),
  content text NOT NULL CHECK(length(content)<=10000),
  caption text NOT NULL DEFAULT '' CHECK(length(caption)<=2000),
  media_ref text,
  audience text NOT NULL DEFAULT 'everyone' CHECK(audience IN ('everyone','contacts','selected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  deleted_at timestamptz,
  CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS user_statuses_feed_idx ON user_statuses(user_id,created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS user_statuses_expiry_idx ON user_statuses(expires_at) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS status_views (
  status_id text NOT NULL REFERENCES user_statuses(id) ON DELETE CASCADE,
  viewer_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(status_id,viewer_id)
);
CREATE TABLE IF NOT EXISTS moderation_reports (
  id text PRIMARY KEY,
  reporter_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK(target_type IN ('user','message','group','status','media','post','community')),
  target_id text NOT NULL,
  category text NOT NULL CHECK(category IN ('spam','harassment','impersonation','copyright','illegal','other')),
  description text NOT NULL DEFAULT '' CHECK(length(description)<=4000),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','action_taken','dismissed')),
  reviewer_id text REFERENCES accounts(id) ON DELETE SET NULL,
  action_note text NOT NULL DEFAULT '' CHECK(length(action_note)<=4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS moderation_reports_queue_idx ON moderation_reports(created_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS moderation_reports_target_idx ON moderation_reports(target_type,target_id,created_at DESC);
CREATE TABLE IF NOT EXISTS user_devices (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_name text NOT NULL CHECK(length(device_name) BETWEEN 1 AND 160),
  platform text NOT NULL CHECK(platform IN ('Android','Windows','macOS','Web','iPadOS','iOS','Linux','Other')),
  client_label text NOT NULL DEFAULT '' CHECK(length(client_label)<=160),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_devices_active_idx ON user_devices(user_id,last_seen_at DESC) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(preferences)='object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
