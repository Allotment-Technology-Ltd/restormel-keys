-- RES-113 PR-L — M4 enforced key-scope: "the key IS the connection" (REC-ADR-018 addendum §4).
--
-- A Gateway key stops being a generic, purpose-free credential and becomes a PURPOSE-BOUND
-- connection: it carries WHAT it is (connection type), WHAT it may do (access level), and WHICH
-- graph/workspace it serves (target). The plain-language M4 badge ("look things up" vs "look up
-- AND contribute back") then sits on top of a REAL authorisation scope — read genuinely restricts
-- to retrieve; read+write is what gates connect.memory.write (REC-ADR-018 addendum §2).
--
-- Columns added to api_keys (all NULLABLE — legacy/flat keys keep NULL and are grandfathered):
--   key_type  — connection shape: 'mcp' | 'rest' (MVP types; REC-ADR-018 addendum §1).
--   access    — enforced scope:   'read' | 'read_write'.
--   target    — the graph/workspace this key serves (audit + display; hard workspace/project
--               scoping is already enforced structurally via api_keys.project_id → projects).
--
-- NOTE: `status` ('active' | 'revoked') is NOT added here — it already exists on api_keys from
--   004_control_plane_tables.sql (DEFAULT 'active') and is reused as the connection status.
--
-- Additive + backward compatible:
--   * Existing rows get NULL key_type/access/target → treated as legacy unscoped keys. The
--     enforcement decision (key-scope.ts) grandfathers a NULL-access key as read+write so the
--     authorisation model is UNCHANGED until the onboardingJourney flag flips ON (REC-ADR-021 §4).
--   * No backfill. No data migration. No NOT NULL.
--   * CHECK constraints are NULL-permissive: they constrain only the set of NON-NULL values, so
--     legacy NULL rows never violate them, and a bad enum value can never be persisted.
--
-- The migration applies at deploy (fail-closed); it is NOT applied here (deploy applies it).
--
-- Rollback (reverse of every change above; run in this order):
--   ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_key_type_check;
--   ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_access_check;
--   DROP INDEX IF EXISTS idx_api_keys_project_access;
--   ALTER TABLE api_keys DROP COLUMN IF EXISTS target;
--   ALTER TABLE api_keys DROP COLUMN IF EXISTS access;
--   ALTER TABLE api_keys DROP COLUMN IF EXISTS key_type;
--   (api_keys.status stays — it pre-existed this migration.)

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_type TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS access TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS target TEXT;

-- Constrain the non-null value sets (NULL = legacy, always allowed). Idempotent guard so a
-- partial re-run never double-adds (pattern from 050_knowledge_graph_unit_source_required.sql).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_key_type_check'
  ) THEN
    ALTER TABLE api_keys
      ADD CONSTRAINT api_keys_key_type_check
      CHECK (key_type IS NULL OR key_type IN ('mcp', 'rest'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_access_check'
  ) THEN
    ALTER TABLE api_keys
      ADD CONSTRAINT api_keys_access_check
      CHECK (access IS NULL OR access IN ('read', 'read_write'));
  END IF;
END $$;

-- Accelerate the connections-manager list (typed keys for a project). Partial index: only the
-- scoped (non-legacy) keys are indexed, so legacy-heavy tables pay nothing.
CREATE INDEX IF NOT EXISTS idx_api_keys_project_access
  ON api_keys (project_id, access)
  WHERE access IS NOT NULL;
