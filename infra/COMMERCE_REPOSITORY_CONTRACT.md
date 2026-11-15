# Commerce repository contract

`src/server/repositories/commerce.ts` adds transaction-scoped cart and order primitives.

- Cart mutations are scoped to the supplied authenticated user ID; routes must derive this ID from the verified session, never request JSON.
- Product availability and prices are read from PostgreSQL, not client-submitted amounts.
- Order creation locks product rows in deterministic ID order, validates a single currency and stock, decrements stock conditionally, stores immutable line snapshots, clears purchased cart lines, and writes an outbox event.
- The caller MUST wrap the operation in one PostgreSQL transaction and pair it with request idempotency. On any error the caller must roll back the transaction.
- Payment authorization/capture is deliberately separate. An order created here is pending and is not proof of payment.
- No payment secrets or raw payment credentials are accepted or persisted.

Remaining: authenticated Express route conversion, transaction wrapper and idempotency middleware, payment-provider order/capture/webhook integration, refunds, inventory restoration on cancellation, integration tests against PostgreSQL, and migration of existing JSON commerce records.
