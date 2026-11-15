# Community and group-chat integration contract

Migration `0015_community_group_links.sql` stores explicit community-to-group relationships.

- A community owner/moderator and a group owner/admin must both authorize linking.
- Joining a linked group requires existing membership in the linked community.
- Adding a member to a linked group is rejected unless that person is already a member of its community.
- Membership, group settings, and outbox events must be committed in the caller's single PostgreSQL transaction.
- These are repository primitives and tests; legacy Express endpoints are not yet switched to PostgreSQL. Production remains fail-closed until route conversion and full authorization parity are verified.
