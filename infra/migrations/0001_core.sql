-- GB Official foundational PostgreSQL schema.
-- This migration is intentionally additive. It does not migrate legacy JSON data
-- or enable production startup; see infra/ACTIVE_ACTIVE_DESIGN.md.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  username text NOT NULL,
  username_normalized text NOT NULL UNIQUE,
  email text,
  email_normalized text UNIQUE,
  phone text,
  display_name text,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'deletion_pending', 'deleted')),
  home_region text NOT NULL DEFAULT 'region-unassigned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE INDEX IF NOT EXISTS accounts_status_created_idx ON accounts(account_status, created_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  device_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS user_sessions_user_expiry_idx ON user_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS conversations (
  id text PRIMARY KEY,
  conversation_type text NOT NULL DEFAULT 'direct'
    CHECK (conversation_type IN ('direct', 'group', 'community', 'channel')),
  owner_region text NOT NULL DEFAULT 'region-unassigned',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE INDEX IF NOT EXISTS conversations_region_updated_idx ON conversations(owner_region, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS conversation_members_user_idx ON conversation_members(user_id, conversation_id);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  client_message_id text,
  body jsonb NOT NULL,
  owner_region text NOT NULL DEFAULT 'region-unassigned',
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  UNIQUE (sender_id, client_message_id)
);
CREATE INDEX IF NOT EXISTS messages_conversation_timeline_idx
  ON messages(conversation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS messages_sender_created_idx ON messages(sender_id, created_at DESC);

CREATE TABLE IF NOT EXISTS posts (
  id text PRIMARY KEY,
  author_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  body jsonb NOT NULL,
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'followers', 'private')),
  owner_region text NOT NULL DEFAULT 'region-unassigned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS posts_author_timeline_idx ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_region_timeline_idx ON posts(owner_region, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS follows (
  follower_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  following_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id, status, follower_id);

-- Transactional outbox: write domain changes and their event records in one DB transaction.
CREATE TABLE IF NOT EXISTS event_outbox (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  partition_key text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
CREATE INDEX IF NOT EXISTS event_outbox_pending_idx
  ON event_outbox(occurred_at, event_id) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (scope, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idempotency_expiry_idx ON idempotency_keys(expires_at);

CREATE TABLE IF NOT EXISTS region_partition_ownership (
  partition_key text PRIMARY KEY,
  owner_region text NOT NULL,
  ownership_epoch bigint NOT NULL CHECK (ownership_epoch > 0),
  lease_expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_id text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
