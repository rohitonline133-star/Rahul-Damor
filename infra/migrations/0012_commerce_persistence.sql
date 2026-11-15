-- Commerce persistence primitives. Never store raw card numbers, CVV, UPI PINs,
-- bank credentials, or payment-provider secrets in this database.
CREATE TABLE IF NOT EXISTS shop_products (
  id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 180),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 12000),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  unit_amount_minor bigint NOT NULL CHECK (unit_amount_minor >= 0),
  category text NOT NULL DEFAULT '' CHECK (length(category) <= 120),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  stock_quantity bigint NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_products_seller_created_idx
  ON shop_products(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_products_active_category_idx
  ON shop_products(category, created_at DESC) WHERE is_active;

CREATE TABLE IF NOT EXISTS shop_carts (
  user_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shop_cart_items (
  user_id text NOT NULL REFERENCES shop_carts(user_id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES shop_products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS shop_orders (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  shipping_minor bigint NOT NULL DEFAULT 0 CHECK (shipping_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  order_status text NOT NULL DEFAULT 'pending'
    CHECK (order_status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','authorized','paid','failed','refunded')),
  shipping_address jsonb NOT NULL CHECK (jsonb_typeof(shipping_address) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_minor = subtotal_minor + shipping_minor)
);
CREATE INDEX IF NOT EXISTS shop_orders_user_created_idx
  ON shop_orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS shop_order_items (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id text REFERENCES shop_products(id) ON DELETE SET NULL,
  product_name text NOT NULL CHECK (length(product_name) BETWEEN 1 AND 180),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
  unit_amount_minor bigint NOT NULL CHECK (unit_amount_minor >= 0),
  image_url text
);
CREATE INDEX IF NOT EXISTS shop_order_items_order_idx ON shop_order_items(order_id);

CREATE TABLE IF NOT EXISTS payment_provider_references (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 40),
  provider_reference text NOT NULL CHECK (length(provider_reference) BETWEEN 1 AND 255),
  method_type text NOT NULL CHECK (method_type IN ('card','upi','paypal','other')),
  brand text,
  last4 char(4),
  exp_month smallint CHECK (exp_month BETWEEN 1 AND 12),
  exp_year smallint CHECK (exp_year BETWEEN 2024 AND 2200),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_reference)
);
CREATE INDEX IF NOT EXISTS payment_provider_user_idx
  ON payment_provider_references(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  order_id text REFERENCES shop_orders(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 40),
  provider_transaction_id text,
  transaction_type text NOT NULL CHECK (transaction_type IN ('subscription','shop_purchase','transfer','refund')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('pending','completed','failed','refunded')),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_transaction_id)
);
CREATE INDEX IF NOT EXISTS payment_transactions_user_created_idx
  ON payment_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('free','pro','business')),
  status text NOT NULL CHECK (status IN ('active','cancelled','past_due','expired')),
  provider text,
  provider_subscription_id text UNIQUE,
  price_minor bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency ~ '^[A-Z]{3}$'),
  renewal_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_webhook_receipts (
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 40),
  provider_event_id text NOT NULL CHECK (length(provider_event_id) BETWEEN 1 AND 255),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  outcome text CHECK (outcome IN ('processed','ignored','failed')),
  PRIMARY KEY(provider, provider_event_id)
);
