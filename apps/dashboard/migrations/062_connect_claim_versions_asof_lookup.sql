-- Stage 3.3 (temporal validity + as-of retrieval, verified-memory ADR §2):
-- as-of chain lookups read version rows for PRIOR unit ids whose validity window is
-- CLOSED (valid_to set). The Stage 3.2 partial index
-- idx_connect_claim_versions_unit (… WHERE valid_to IS NULL) cannot serve those, so
-- add a full (workspace_id, unit_id) index for version-chain resolution.
--
-- Rollback: DROP INDEX IF EXISTS idx_connect_claim_versions_unit_all;
CREATE INDEX IF NOT EXISTS idx_connect_claim_versions_unit_all
  ON connect_claim_versions (workspace_id, unit_id);
