-- Migration 072: knowledge_readiness_runs + knowledge_readiness_run_units (prod relation-missing fix).
--
-- ROOT CAUSE (incident 2026-06-19-knowledge-readiness-runs-missing-migration / REC-INC-005):
-- the readiness-runs feature writes to `knowledge_readiness_runs` (and its child table
-- `knowledge_readiness_run_units`). Both tables are created ONLY as RUNTIME DDL inside
-- ensureIngestionRoutingSchema() (neon.ts ~line 2649-2688). Runtime DDL is DISABLED in
-- production (CONNECT_RUNTIME_DDL=0 via NODE_ENV=production, per runtimeDdlEnabled() at
-- neon.ts:56), so these tables were never created in prod. Every readiness-check API call
-- throws `relation "knowledge_readiness_runs" does not exist` (Postgres error 42P01).
--
-- This migration brings the prod schema to parity with the code's expectation, mirroring
-- the runtime DDL EXACTLY (neon.ts ~2649-2688). Idempotent and safe to re-run.
-- After this, REQUIRED_MIGRATION is bumped to 072 so the drift gate fails loudly at
-- deploy/boot if this migration is ever missing again.
--
-- This is the same class of bug as REC-INC-003 (2026-06-18 "Add a graph" 500, fixed by
-- migration 070_knowledge_graph_targets_graph_library.sql). The pattern: code added a
-- runtime-DDL block for new tables/columns but no numbered migration, so dev/CI (where
-- runtime DDL is enabled) never surfaced the gap, but prod (where it is disabled) crashed.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS knowledge_readiness_run_units;
--   DROP TABLE IF EXISTS knowledge_readiness_runs;

-- Readiness runs: a named pass that takes a cohort (the next N unlinked ideas)
-- through link → embed → validate, with durable per-step status + quality rollup.
CREATE TABLE IF NOT EXISTS knowledge_readiness_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain_pack_id TEXT,
  label TEXT NOT NULL,
  size_target INTEGER NOT NULL,
  size_actual INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  link_job_id TEXT,
  embed_job_id TEXT,
  validate_job_id TEXT,
  quality_summary JSONB,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT knowledge_readiness_runs_status_check CHECK (
    status IN ('draft', 'linking', 'linked', 'embedding', 'embedded', 'validating', 'complete', 'archived')
  )
);

-- Hot path: list a workspace's runs newest-first.
CREATE INDEX IF NOT EXISTS idx_knowledge_readiness_runs_workspace_updated
  ON knowledge_readiness_runs (workspace_id, updated_at DESC);

-- Filter by status within a workspace.
CREATE INDEX IF NOT EXISTS idx_knowledge_readiness_runs_workspace_status
  ON knowledge_readiness_runs (workspace_id, status);

-- Cohort membership (store-neutral: units may live in Postgres or Surreal).
CREATE TABLE IF NOT EXISTS knowledge_readiness_run_units (
  run_id TEXT NOT NULL REFERENCES knowledge_readiness_runs(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  PRIMARY KEY (run_id, unit_id)
);

-- Look up all runs that contain a given unit.
CREATE INDEX IF NOT EXISTS idx_knowledge_readiness_run_units_unit
  ON knowledge_readiness_run_units (unit_id);
