-- Hosted runtime jobs: idempotency, cancellation, merge strategy (Phase 4 worker).

ALTER TABLE hosted_runtime_jobs ADD COLUMN IF NOT EXISTS idempotency_key_hash TEXT;
ALTER TABLE hosted_runtime_jobs ADD COLUMN IF NOT EXISTS cancel_requested_at BIGINT;
ALTER TABLE hosted_runtime_jobs ADD COLUMN IF NOT EXISTS merge_strategy TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hosted_runtime_jobs_idempotency
  ON hosted_runtime_jobs (project_id, user_id, idempotency_key_hash)
  WHERE idempotency_key_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hosted_runtime_jobs_queued
  ON hosted_runtime_jobs (status, created_at)
  WHERE status = 'queued';
