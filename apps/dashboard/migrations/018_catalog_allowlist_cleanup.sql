-- 018_catalog_allowlist_cleanup.sql
-- Normalize stale catalog entries after default allowlist rollout.
--
-- This migration is intentionally non-destructive:
-- - stale provider variants are marked retired/unavailable (not deleted)
-- - models with no remaining available variants are marked deprecated

WITH stale_variants(provider_id, provider_model_id) AS (
  VALUES
    ('openai', 'gpt-4-turbo'),
    ('openai', 'gpt-4-turbo-mini'),
    ('openai', 'gpt-3.5-turbo'),
    ('anthropic', 'claude-3-opus-20240229'),
    ('anthropic', 'claude-3-sonnet-20240229'),
    ('anthropic', 'claude-3-haiku-20240329'),
    ('google', 'gemini-1.0-pro')
)
UPDATE provider_model_variants pmv
SET
  availability_status = 'retired',
  metadata = COALESCE(pmv.metadata, '{}'::jsonb) || jsonb_build_object(
    'catalogCleanup',
    jsonb_build_object(
      'source', '018_catalog_allowlist_cleanup',
      'reason', 'removed_from_default_provider_allowlist'
    )
  ),
  source_last_verified_at = (extract(epoch from now()) * 1000)::bigint
FROM stale_variants sv
WHERE COALESCE(pmv.catalog_provider_id, pmv.provider_integration_type) = sv.provider_id
  AND pmv.provider_model_id = sv.provider_model_id;

UPDATE models m
SET lifecycle_state = 'deprecated'
WHERE COALESCE(m.lifecycle_state, 'active') NOT IN ('deprecated', 'retired')
  AND EXISTS (
    SELECT 1
    FROM provider_model_variants pmv
    WHERE pmv.model_id = m.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM provider_model_variants pmv
    WHERE pmv.model_id = m.id
      AND lower(COALESCE(pmv.availability_status, '')) = 'available'
  );
