-- 017_catalog_provider_id.sql
-- Add canonical provider identifier for catalog variants to support downstream provider mapping.

ALTER TABLE provider_model_variants
  ADD COLUMN IF NOT EXISTS catalog_provider_id TEXT;

UPDATE provider_model_variants
SET catalog_provider_id = provider_integration_type
WHERE catalog_provider_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_provider_model_variants_catalog_provider_id
  ON provider_model_variants(catalog_provider_id);
