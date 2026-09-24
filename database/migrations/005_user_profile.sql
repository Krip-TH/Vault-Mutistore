-- Apply once to an existing VAULT database after the users table exists.
-- Adds optional, nullable customer profile columns. users.name is reused as the full name.
-- Existing customer and admin rows are unchanged (all new columns default to NULL).
USE vault_multistore;

ALTER TABLE users
  ADD COLUMN phone VARCHAR(40) NULL AFTER role,
  ADD COLUMN address VARCHAR(255) NULL AFTER phone,
  ADD COLUMN city VARCHAR(120) NULL AFTER address,
  ADD COLUMN province VARCHAR(120) NULL AFTER city,
  ADD COLUMN postal_code VARCHAR(20) NULL AFTER province,
  ADD COLUMN country VARCHAR(120) NULL AFTER postal_code,
  ADD COLUMN profile_image_url VARCHAR(2048) NULL AFTER country;
