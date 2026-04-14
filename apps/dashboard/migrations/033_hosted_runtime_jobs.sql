-- Hosted runtime async jobs (Phase 4 scaffold): persisted rows for POST …/runtime/jobs.
-- Linear routes may complete synchronously; parallel fan-out remains gated (see RFC).

CREATE TABLE IF NOT EXISTS hosted_runtime_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  status TEXT NOT NULL,
  request_summary JSONB NOT NULL,
  result_summary JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT hosted_runtime_jobs_status_check CHECK (
    status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_hosted_runtime_jobs_project_created
  ON hosted_runtime_jobs (project_id, created_at DESC);
