-- Stage 1.6 (durable run execution): worker lease + heartbeat on ingest jobs.
--
-- F1 follow-up from the Stage 1.5 reliability review: ingest runs execute inside a
-- Vercel request invocation; when the instance is recycled the run dies silently and
-- the job stays 'running' forever (claim only takes 'pending'; no stale reclaim).
--
-- These columns make a frozen run detectable and reclaimable:
--   * worker_id            — fencing token set at claim time; worker-side job updates
--                            are guarded by it so a zombie worker (suspended instance
--                            resumed after reclaim) cannot resurrect a reclaimed job.
--   * lease_expires_at     — Unix ms; set at claim, extended by the worker-loop
--                            heartbeat. A 'running' job whose lease has expired is
--                            considered lost and is reclaimed (status -> 'failed',
--                            error 'worker_lost: …', operator-visible console event).
--   * worker_heartbeat_at  — Unix ms of the last worker-loop heartbeat (diagnostics).
--   * reclaim_count        — how many times the job was reclaimed after a stall.
ALTER TABLE knowledge_ingest_jobs ADD COLUMN IF NOT EXISTS worker_id TEXT;
ALTER TABLE knowledge_ingest_jobs ADD COLUMN IF NOT EXISTS lease_expires_at BIGINT;
ALTER TABLE knowledge_ingest_jobs ADD COLUMN IF NOT EXISTS worker_heartbeat_at BIGINT;
ALTER TABLE knowledge_ingest_jobs ADD COLUMN IF NOT EXISTS reclaim_count INTEGER NOT NULL DEFAULT 0;

-- Reclaim scans 'running' jobs by lease expiry; keep the partial index tiny.
CREATE INDEX IF NOT EXISTS idx_knowledge_ingest_jobs_running_lease
  ON knowledge_ingest_jobs (lease_expires_at)
  WHERE status = 'running';
