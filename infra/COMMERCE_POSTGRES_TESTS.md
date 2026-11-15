# PostgreSQL commerce integration test coverage

`tests/postgres-commerce-integration.test.ts` runs against the CI PostgreSQL service when `DATABASE_URL` is configured. It verifies a real transaction spanning account/product fixtures, cart insert, order creation, inventory decrement, order-line snapshot, cart cleanup, and outbox insertion. A second case verifies insufficient inventory cannot create an order or change stock. Both tests roll back their fixtures and are skipped in environments without a configured test database.

These tests do not exercise payment provider APIs, webhook signature verification, HTTP authorization, refunds, concurrent contention, or legacy JSON migration.
