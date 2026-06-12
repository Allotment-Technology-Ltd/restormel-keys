-- W3.4 handoff: add source_run_id to connect_eval_verdicts so quality-history rows
-- produced by ingest runs can cross-link back to the producing run console.
-- Nullable: CLI and CI-action verdicts have no associated ingest job.
ALTER TABLE connect_eval_verdicts
  ADD COLUMN IF NOT EXISTS source_run_id TEXT;

-- Partial index: enables efficient "find verdicts for this run" lookups used by the
-- run console's quality link, without paying index overhead on the CLI / CI rows.
CREATE INDEX IF NOT EXISTS idx_connect_eval_verdicts_source_run
  ON connect_eval_verdicts (workspace_id, source_run_id)
  WHERE source_run_id IS NOT NULL;
