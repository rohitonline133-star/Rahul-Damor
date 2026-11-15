-- Explicit many-to-many relationship between community spaces and group chats.
CREATE TABLE IF NOT EXISTS community_groups (
  community_id text NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, group_id)
);
CREATE INDEX IF NOT EXISTS community_groups_group_idx
  ON community_groups(group_id, community_id);
