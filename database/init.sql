CREATE DATABASE IF NOT EXISTS moodeng_multistore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE moodeng_multistore;

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
  image_url VARCHAR(2048) NULL,
  attributes JSON NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_cache_business_product (business_id, external_product_id),
  CONSTRAINT fk_products_cache_business FOREIGN KEY (business_id) REFERENCES businesses(id)
    ON UPDATE CASCADE ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_no (order_no),
  KEY idx_orders_customer_email_created (customer_email, created_at),
  KEY idx_orders_status_created (status, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  business VARCHAR(50) NOT NULL,
  business_name VARCHAR(120) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NULL,
  image_url VARCHAR(2048) NULL,
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

INSERT INTO businesses (name, business_type, status) VALUES
  ('Door Business', 'Door', 'inactive'),
  ('Electrical Plug Business', 'Electrical Plug', 'inactive'),
  ('Brandname Business', 'Brandname', 'inactive'),
  ('Clothing Business', 'Clothing', 'inactive'),
  ('Powerbank Business', 'Powerbank', 'inactive'),
  ('Projector Business', 'Projector', 'inactive')
ON DUPLICATE KEY UPDATE name = VALUES(name);
