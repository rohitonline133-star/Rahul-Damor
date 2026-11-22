-- Preserve legacy account fields needed during the JSON-to-PostgreSQL auth cutover.
-- Existing accounts receive conservative defaults; no privilege is inferred or elevated.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Keep role values explicit and prevent arbitrary privilege labels from being stored.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_role_allowed'
      AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_role_allowed
      CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS accounts_presence_idx
  ON accounts(is_online, last_seen_at DESC)
  WHERE account_status = 'active';
