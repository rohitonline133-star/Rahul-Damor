-- Enforce ownership at the database boundary, not only in repository predicates.
-- The redundant (id,user_id) unique key enables composite foreign keys so a
-- payment attempt/transaction cannot be attached to another user's order.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shop_orders_id_user_id_unique'
      AND conrelid = 'shop_orders'::regclass
  ) THEN
    ALTER TABLE shop_orders
      ADD CONSTRAINT shop_orders_id_user_id_unique UNIQUE (id, user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shop_payment_attempts_order_user_fk'
      AND conrelid = 'shop_payment_attempts'::regclass
  ) THEN
    ALTER TABLE shop_payment_attempts
      ADD CONSTRAINT shop_payment_attempts_order_user_fk
      FOREIGN KEY (order_id, user_id)
      REFERENCES shop_orders (id, user_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_transactions_order_user_fk'
      AND conrelid = 'payment_transactions'::regclass
  ) THEN
    ALTER TABLE payment_transactions
      ADD CONSTRAINT payment_transactions_order_user_fk
      FOREIGN KEY (order_id, user_id)
      REFERENCES shop_orders (id, user_id)
      ON DELETE RESTRICT;
  END IF;
END $$;
