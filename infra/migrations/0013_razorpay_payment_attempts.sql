-- Durable mapping between local shop orders and Razorpay order/payment IDs.
CREATE TABLE IF NOT EXISTS shop_payment_attempts (
 id text PRIMARY KEY,
 order_id text NOT NULL REFERENCES shop_orders(id) ON DELETE RESTRICT,
 user_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 provider text NOT NULL CHECK (provider='razorpay'),
 provider_order_id text NOT NULL UNIQUE CHECK (length(provider_order_id) BETWEEN 1 AND 255),
 provider_payment_id text UNIQUE CHECK (provider_payment_id IS NULL OR length(provider_payment_id) BETWEEN 1 AND 255),
 amount_minor bigint NOT NULL CHECK (amount_minor >= 100),
 currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','captured','failed','refunded')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 captured_at timestamptz,
 UNIQUE(id,order_id,user_id)
);
CREATE INDEX IF NOT EXISTS shop_payment_attempts_order_idx ON shop_payment_attempts(order_id,created_at DESC);
CREATE INDEX IF NOT EXISTS shop_payment_attempts_user_idx ON shop_payment_attempts(user_id,created_at DESC);
