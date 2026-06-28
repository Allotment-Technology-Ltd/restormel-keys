-- EBV read-time freshness audit (docs/decisions/evidence-bound-verification.md §2):
-- "Layer 1 results are recorded in the provenance trace as { span, offsets, source_hash,
-- checked_at, result }. Because it is deterministic over hashed content, it is re-runnable
-- at read time ... so verification cannot silently rot."
--
-- Strict (require_verified) retrieval re-runs a fresh deterministic Layer-1 pass over each
-- served supported/inferred claim version and demotes any whose source version has rotted.
-- These columns persist the latest such read-time recheck per claim VERSION so the result
-- is auditable and the trust scorecard can report a "freshly verified" share without
-- re-resolving every source on each read.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS): nullable, defaulted to NULL, never
-- rewrites existing rows. Safe to apply on the host-managed Postgres spine fail-closed.
-- A NULL last_rechecked_at simply means "no read-time recheck has run for this version yet"
-- — never presumed fresh (the same demote-only fail-safe as the rest of EBV).
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_connect_claim_versions_recheck;
--   ALTER TABLE connect_claim_versions
--     DROP COLUMN IF EXISTS last_rechecked_at,
--     DROP COLUMN IF EXISTS recheck_source_hash,
--     DROP COLUMN IF EXISTS recheck_result;

ALTER TABLE connect_claim_versions
  ADD COLUMN IF NOT EXISTS last_rechecked_at   TIMESTAMPTZ,
  -- The source-version content hash the read-time pass checked against (the LIVE source
  -- at recheck time). Compared to source_hash to detect drift; differs ⇒ stale_source.
  ADD COLUMN IF NOT EXISTS recheck_source_hash TEXT,
  -- recheck_result domain: fresh | stale_source | span_lost | offsets_out_of_range | source_unavailable | no_bound_span
  ADD COLUMN IF NOT EXISTS recheck_result      TEXT;

-- Serve the scorecard's "fresh-supported %" over CURRENT versions cheaply: only current
-- rows (valid_to IS NULL) that have actually been rechecked.
CREATE INDEX IF NOT EXISTS idx_connect_claim_versions_recheck
  ON connect_claim_versions (workspace_id, recheck_result)
  WHERE valid_to IS NULL AND last_rechecked_at IS NOT NULL;
