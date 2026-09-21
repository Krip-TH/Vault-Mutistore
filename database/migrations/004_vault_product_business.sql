USE vault_multistore;

-- Existing rows remain nullable because the previous schema did not record a
-- catalog business. Admins must select a real business/category when editing
-- those legacy products; all newly created products require this value.
ALTER TABLE vault_products
  ADD COLUMN business_key VARCHAR(50) NULL AFTER id,
  ADD KEY idx_vault_products_business_category (business_key, category);
