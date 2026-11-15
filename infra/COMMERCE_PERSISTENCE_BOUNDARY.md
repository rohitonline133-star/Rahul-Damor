# Commerce persistence boundary

Migration `0012_commerce_persistence.sql` adds PostgreSQL tables for products, carts, immutable order-line snapshots, provider payment references, transaction records, subscriptions, and idempotent webhook receipts.

## Security and accounting rules

- Monetary values are integer minor units (for example, paise), never floating-point currency values. Currency is an ISO-style three-letter code.
- The database must never store PAN/card numbers, CVV, UPI PINs, bank login credentials, provider API secrets, or raw webhook signing secrets.
- `payment_provider_references.provider_reference` must be an opaque token/reference issued by the configured payment provider, not payment credentials.
- Verify payment signatures against the raw request body before recording a webhook receipt or changing order/payment state.
- Enforce provider event idempotency using `commerce_webhook_receipts`; apply receipt, transaction, order-state transition, and outbox event in one transaction.
- The schema does not initiate charges, capture funds, issue refunds, or prove a provider is configured.
- Inventory reservation/decrement must use conditional SQL updates in the same transaction as order creation; never trust client prices or stock counts.
- Shipping address JSON must be validated and access-controlled; minimize retention and redact it from logs.

## Remaining integration

The legacy Express shop, cart, order, payment-method, transaction, and subscription handlers still use the JSON store. They must be migrated to typed repositories with authenticated ownership checks, idempotency keys, transactional inventory reservation, provider webhook verification, outbox publication, and PostgreSQL integration tests before production startup can be enabled.

No legacy JSON commerce records have been imported by this migration.
