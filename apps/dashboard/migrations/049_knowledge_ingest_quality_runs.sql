-- Admin ingest quality evaluation runs (manual threshold loop).
CREATE TABLE IF NOT EXISTS knowledge_ingest_quality_runs (
  id TEXT PRIMARY KEY,
  window_days INTEGER NOT NULL,
  status TEXT NOT NULL,
  fired JSONB NOT NULL DEFAULT '[]'::jsonb,
  brief_markdown TEXT,
  applied_actions JSONB,
  created_by_user_id TEXT,
  created_at BIGINT NOT NULL,
  applied_at BIGINT,
  CONSTRAINT knowledge_ingest_quality_runs_status_check CHECK (
    status IN ('evaluated', 'applied', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_ingest_quality_runs_created
  ON knowledge_ingest_quality_runs (created_at DESC);
