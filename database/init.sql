CREATE DATABASE IF NOT EXISTS vault_multistore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vault_multistore;

CREATE TABLE IF NOT EXISTS businesses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  business_type VARCHAR(50) NOT NULL,
  api_url VARCHAR(2048) NULL,
  status ENUM('active', 'inactive', 'unavailable') NOT NULL DEFAULT 'inactive',
  last_checked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_businesses_business_type (business_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products_cache (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_id BIGINT UNSIGNED NOT NULL,
  external_product_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NOT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  image_url TEXT NULL,
  attributes JSON NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_cache_business_product (business_id, external_product_id),
  CONSTRAINT fk_products_cache_business FOREIGN KEY (business_id) REFERENCES businesses(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- Products authored and owned by VAULT. External adapter products remain read-only
-- and products_cache remains a non-authoritative integration cache.
CREATE TABLE IF NOT EXISTS vault_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_key VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NOT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
  image_url VARCHAR(2048) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vault_products_category (category),
  KEY idx_vault_products_business_category (business_key, category),
  KEY idx_vault_products_updated (updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sync_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_id BIGINT UNSIGNED NOT NULL,
  status ENUM('success', 'failed', 'partial') NOT NULL,
  products_received INT UNSIGNED NOT NULL DEFAULT 0,
  message TEXT NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sync_logs_business_synced (business_id, synced_at),
  CONSTRAINT fk_sync_logs_business FOREIGN KEY (business_id) REFERENCES businesses(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  phone VARCHAR(40) NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  province VARCHAR(120) NULL,
  postal_code VARCHAR(20) NULL,
  country VARCHAR(120) NULL,
  profile_image_url VARCHAR(2048) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  order_no VARCHAR(32) NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  customer_email VARCHAR(254) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  shipping_address_line1 VARCHAR(255) NOT NULL,
  shipping_address_line2 VARCHAR(255) NULL,
  shipping_district VARCHAR(120) NOT NULL,
  shipping_province VARCHAR(120) NOT NULL,
  shipping_postal_code VARCHAR(20) NOT NULL,
  shipping_country VARCHAR(120) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12, 2) NOT NULL,
  status ENUM('pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_no (order_no),
  KEY idx_orders_user_created (user_id, created_at),
  KEY idx_orders_customer_email_created (customer_email, created_at),
  KEY idx_orders_status_created (status, created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  business VARCHAR(50) NOT NULL,
  business_name VARCHAR(120) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NULL,
  image_url TEXT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_business_product (business, product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- Per-day counter for claim numbers. Allocated inside the claim transaction with
-- INSERT ... ON DUPLICATE KEY UPDATE so concurrent requests never share a number.
CREATE TABLE IF NOT EXISTS claim_number_sequences (
  sequence_date DATE NOT NULL,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sequence_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS claims (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  claim_number VARCHAR(32) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('submitted', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled')
    NOT NULL DEFAULT 'submitted',
  reason ENUM('damaged', 'defective', 'wrong_item', 'missing_parts', 'other') NOT NULL,
  description TEXT NOT NULL,
  contact_phone VARCHAR(40) NULL,
  -- Customer-visible note. Internal-only notes live in claim_status_history.
  admin_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_claims_claim_number (claim_number),
  KEY idx_claims_user_created (user_id, created_at),
  KEY idx_claims_status_created (status, created_at),
  KEY idx_claims_order (order_id),
  CONSTRAINT fk_claims_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_claims_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Snapshot columns mirror order_items so a claim document never changes when
-- catalogue data changes later.
CREATE TABLE IF NOT EXISTS claim_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  claim_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  business VARCHAR(50) NOT NULL,
  business_name VARCHAR(120) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_claim_items_claim_order_item (claim_id, order_item_id),
  KEY idx_claim_items_order_item (order_item_id),
  KEY idx_claim_items_business (business),
  CONSTRAINT fk_claim_items_claim FOREIGN KEY (claim_id) REFERENCES claims(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_claim_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS claim_evidence (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  claim_id BIGINT UNSIGNED NOT NULL,
  -- Server-generated storage name; the original client filename is never used as a path.
  file_name VARCHAR(255) NOT NULL,
  image_url VARCHAR(2048) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_claim_evidence_claim (claim_id),
  CONSTRAINT fk_claim_evidence_claim FOREIGN KEY (claim_id) REFERENCES claims(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS claim_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  claim_id BIGINT UNSIGNED NOT NULL,
  previous_status ENUM('submitted', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled')
    NULL DEFAULT NULL,
  new_status ENUM('submitted', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled')
    NOT NULL,
  -- NULL once the acting account is deleted; the audit row itself is kept.
  changed_by BIGINT UNSIGNED NULL,
  changed_by_role ENUM('customer', 'admin') NOT NULL,
  note TEXT NULL,
  -- 'internal' rows are never returned by customer-facing endpoints.
  visibility ENUM('customer', 'internal') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_claim_status_history_claim_created (claim_id, created_at),
  KEY idx_claim_status_history_changed_by (changed_by),
  CONSTRAINT fk_claim_status_history_claim FOREIGN KEY (claim_id) REFERENCES claims(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_claim_status_history_user FOREIGN KEY (changed_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO businesses (name, business_type, status) VALUES
  ('Door Business', 'Door', 'inactive'),
  ('Electrical Plug Business', 'Electrical Plug', 'inactive'),
  ('Brandname Business', 'Brandname', 'inactive'),
  ('Clothing Business', 'Clothing', 'inactive'),
  ('Powerbank Business', 'Powerbank', 'inactive'),
  ('Projector Business', 'Projector', 'inactive')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Default admin account. Password: Admin@12345 (change after first login in a real deployment).
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Moodeng Admin', 'admin@moodeng.com', '$2a$10$6waAXvUSTM0TEJrtSHWvs.Z5PDgC7EgAinaJuae0q.xpv7ZHy87za', 'admin')
ON DUPLICATE KEY UPDATE name = VALUES(name);
