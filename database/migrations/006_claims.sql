-- Apply once to an existing VAULT database after users, orders, and order_items exist.
-- Fresh Docker volumes receive the same schema from database/init.sql.
USE vault_multistore;

-- Orders gain an explicit completion timestamp so the warranty window has a real start
-- date instead of inferring one from updated_at. Existing completed orders are backfilled.
ALTER TABLE orders
  ADD COLUMN completed_at TIMESTAMP NULL DEFAULT NULL AFTER status;

UPDATE orders SET completed_at = updated_at
  WHERE status = 'completed' AND completed_at IS NULL;

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
