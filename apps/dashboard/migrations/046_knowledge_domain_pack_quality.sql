-- Domain pack quality preset (production default) and cross-model validation flag.
ALTER TABLE knowledge_domain_packs
  ADD COLUMN IF NOT EXISTS quality_preset TEXT NOT NULL DEFAULT 'production';

ALTER TABLE knowledge_domain_packs
  ADD COLUMN IF NOT EXISTS cross_model_validation BOOLEAN NOT NULL DEFAULT true;
