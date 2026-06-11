-- W3.8 Testing hub: persisted testing run verdict timeline.
-- Analogous to connect_eval_verdicts (migration 057), but for the Testing suite:
-- stores suite-level pass/fail with goal counts, artifact refs, and commit provenance
-- rather than G2-quality eval metrics.
--
-- Rollback: DROP TABLE testing_run_verdicts;

CREATE TABLE IF NOT EXISTS testing_run_verdicts (
  id              BIGSERIAL   PRIMARY KEY,
  workspace_id    TEXT        NOT NULL,
  evaluated_at    TIMESTAMPTZ NOT NULL,
  pass            BOOLEAN     NOT NULL,
  verdict_schema  TEXT        NOT NULL,
  verdict         JSONB       NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testing_run_verdicts_workspace
  ON testing_run_verdicts (workspace_id, evaluated_at DESC);
