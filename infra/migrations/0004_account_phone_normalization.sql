-- Canonical phone lookup support. Existing non-E.164 legacy values are left
-- untouched and excluded from phone login until explicitly normalized.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS phone_normalized text;

UPDATE accounts
SET phone_normalized = phone
WHERE phone_normalized IS NULL
  AND phone ~ '^\\+[1-9][0-9]{7,14}$';

CREATE UNIQUE INDEX IF NOT EXISTS accounts_phone_normalized_unique
  ON accounts(phone_normalized)
  WHERE phone_normalized IS NOT NULL;
