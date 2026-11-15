CREATE TABLE IF NOT EXISTS status_audience_members (
 status_id text NOT NULL REFERENCES user_statuses(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(status_id,user_id)
);
CREATE INDEX IF NOT EXISTS status_audience_user_idx ON status_audience_members(user_id,status_id);
