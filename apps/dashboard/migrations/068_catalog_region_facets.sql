-- Migration 068: add jurisdiction/region facets to the model catalogue (advisory plan §3.8).
--
-- home_jurisdiction  (models)                — vendor's legal home jurisdiction (e.g. US, EU/FR, CA, CN).
-- processing_region  (provider_model_variants) — where inference actually runs for this route.
--   For aggregators (Together / Aizolo) this is the AGGREGATOR'S processing region, not the
--   underlying vendor's jurisdiction — so the region filter never gives a false sovereignty guarantee.
--   Aizolo's processing region is currently UNVERIFIED; synced rows will carry NULL until confirmed.
--
-- Both columns are nullable: NULL means the value is unknown/unverified, not that it is absent.

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS home_jurisdiction text;

ALTER TABLE provider_model_variants
  ADD COLUMN IF NOT EXISTS processing_region text;
