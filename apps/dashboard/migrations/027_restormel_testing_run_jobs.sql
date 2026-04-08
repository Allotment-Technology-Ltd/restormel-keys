-- Restormel Testing Runs API (sidecar) — persisted job rows for @restormel/testing-runs-server.
-- Apply on the same Neon database you use for the dashboard, or on a dedicated branch.
-- Server env: RESTORMEL_RUNS_DATABASE_URL (preferred) or DATABASE_URL.

CREATE TABLE IF NOT EXISTS restormel_testing_run_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  suite_id TEXT NOT NULL,
  workspace_root TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  goal_completed INTEGER,
  goal_total INTEGER,
  verdict TEXT,
  summary TEXT,
  error_message TEXT,
  artifact_dir TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restormel_testing_run_jobs_status_check CHECK (
    status IN ('queued', 'running', 'passed', 'failed', 'indeterminate', 'error')
  )
);

CREATE INDEX IF NOT EXISTS idx_restormel_testing_run_jobs_created_at
  ON restormel_testing_run_jobs (created_at DESC, id DESC);
