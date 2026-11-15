-- Durable group, community and notification records.
-- Mutations and event_outbox writes are committed by the caller in one transaction.
CREATE TABLE IF NOT EXISTS groups (
  id text PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  created_by text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS group_member_settings (
  conversation_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  notifications_enabled boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS communities (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS community_members (
  community_id text NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','moderator','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS community_members_user_idx ON community_members(user_id, community_id);
CREATE TABLE IF NOT EXISTS user_notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  actor_id text REFERENCES accounts(id) ON DELETE SET NULL,
  notification_type text NOT NULL CHECK (notification_type ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS user_notifications_inbox_idx
  ON user_notifications(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS user_notifications_unread_idx
  ON user_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
