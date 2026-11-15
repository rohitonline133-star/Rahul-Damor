# PostgreSQL conversation history contract

`listConversationMessages` returns a bounded message page only when the viewer is a member of the requested conversation. Membership is enforced in the SELECT itself, and soft-deleted messages are excluded. Pagination uses the stable compound key `(created_at, id)` in descending order; pass the returned `nextCursor` as `before` to fetch older messages. Page sizes are limited to 1–100.

The repository is a persistence primitive, not a route cutover. Existing Express messaging endpoints still use the legacy JSON store. Production remains fail-closed until route authorization, transaction boundaries, attachment access, delivery receipts, realtime fanout, and migration parity are converted and tested.
