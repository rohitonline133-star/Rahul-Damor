-- Persistent, account-scoped post reactions and comments.
-- Domain mutations and outbox events must be committed in one caller-owned transaction.
CREATE TABLE IF NOT EXISTS post_likes (
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS post_likes_user_recent_idx
  ON post_likes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_comments (
  id text PRIMARY KEY,
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  client_comment_id text NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (author_id, client_comment_id)
);
CREATE INDEX IF NOT EXISTS post_comments_timeline_idx
  ON post_comments(post_id, created_at, id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS post_comments_author_recent_idx
  ON post_comments(author_id, created_at DESC);
