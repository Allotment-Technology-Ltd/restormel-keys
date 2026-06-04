-- Live operator telemetry for Connect ingest runs (teleprompter logs + progress).

ALTER TABLE knowledge_ingest_jobs
  ADD COLUMN IF NOT EXISTS current_action TEXT;

ALTER TABLE knowledge_ingest_jobs
  ADD COLUMN IF NOT EXISTS progress JSONB;

CREATE TABLE IF NOT EXISTS knowledge_ingest_job_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES knowledge_ingest_jobs(id) ON DELETE CASCADE,
  line TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_ingest_job_logs_job_seq
  ON knowledge_ingest_job_logs (job_id, id);
