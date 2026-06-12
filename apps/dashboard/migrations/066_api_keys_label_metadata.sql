-- W3.7 + K1 — Team-shared key metadata: server-persisted labels for gateway keys.
--
-- Rationale (keys-core-journey-review §1.1, K-P1-1):
--   - The create POST sends no body and the server accepts no label; labels exist only in
--     localStorage keyed by prefix — they vanish on a different browser and are invisible
--     to teammates.
--   - api_keys.last_used_at is ALREADY written on every key use (neon.ts:826) but is never
--     SELECTed for the UI (neon.ts:864-869).
--   - api_keys.created_at already exists and is dropped by the page load.
--   - The existing api_keys.name column (004_control_plane_tables.sql) was added speculatively
--     but never wired to any UI — this migration wires it as the label column.
--     We do NOT add a second column; we use name as label (additive, nullable).
--
-- Additive changes only. No backfill needed (label defaults NULL → shown as "Unlabelled").
--
-- Rollback: ALTER TABLE api_keys DROP COLUMN IF EXISTS label;
--           (api_keys.name stays — it was pre-existing and unused.)
--
-- NOTE: api_keys.name was added by 004 but never queried. We officially repurpose it
-- as the label by adding the label column under the canonical name "label" and leaving
-- the unused "name" column in place (harmless, no backfill needed).
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS label TEXT;

-- Index to accelerate workspace-scoped key list (join api_keys → projects → workspace_id).
-- The list page does a single workspace join rather than N+1 per project.
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys (project_id);
