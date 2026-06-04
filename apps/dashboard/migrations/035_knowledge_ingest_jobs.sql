-- Knowledge Ingest jobs (Phase 9 / 5b): workspace-scoped durable job rows for POST /knowledge/v1/ingest/jobs.
-- Workers (5d) dequeue pending jobs; this migration is persistence + REST CRUD only.

CREATE TABLE IF NOT EXISTS knowledge_ingest_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  label TEXT,
  current_stage TEXT,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB NOT NULL,
  stop_after_stage TEXT,
  error TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT knowledge_ingest_jobs_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_knowledge_ingest_jobs_workspace_updated
  ON knowledge_ingest_jobs (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_ingest_jobs_workspace_status
  ON knowledge_ingest_jobs (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_knowledge_ingest_jobs_pending
  ON knowledge_ingest_jobs (status, created_at)
  WHERE status = 'pending';
