# Razorpay payment persistence contract

- Verify X-Razorpay-Signature against the exact raw request bytes using isValidRazorpayWebhookSignature before trusting parsed event fields.
- Run applyRazorpayPaymentWebhook inside withPostgresTransaction. Receipt, attempt, order status, transaction record and outbox event commit or roll back together.
- Duplicate provider event IDs return duplicate and do not replay business side effects.
- Captured events must match a stored Razorpay order ID, local user/order, exact minor-unit amount and currency. Clients cannot set payment status.
- Failed events cannot downgrade captured attempts. An attempt cannot be linked to a different provider payment ID.
- No raw card data, CVV, UPI PIN, bank credentials or provider secrets are stored.
- Repository persistence is not yet mounted in legacy Express routes. Production remains disabled until authenticated route integration, raw-body webhook handling, cancellation/refund inventory policy and provider sandbox end-to-end tests are complete.
