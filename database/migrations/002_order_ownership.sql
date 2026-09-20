-- Apply once to an existing VAULT database after the users and orders tables exist.
-- Existing orders remain intact with NULL ownership and are not exposed by user-scoped APIs.
USE vault_multistore;

ALTER TABLE orders
  ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER id,
  ADD KEY idx_orders_user_created (user_id, created_at),
  ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
