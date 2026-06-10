-- Quality-history timeline for the Connect hub (Stage 2.4, verified-context-pivot-roadmap.md).
-- Each row is one persisted ConnectEvalVerdict from the CLI, CI action, or an ingest run.
-- The full verdict + optional regression diff are stored as JSONB so the schema tracks the
-- Stage 2.1/2.2 contracts without a column-per-field explosion; verdict.schema_version
-- is promoted to a top-level column for index/filter efficiency.
CREATE TABLE IF NOT EXISTS connect_eval_verdicts (
  id              BIGSERIAL   PRIMARY KEY,
  workspace_id    TEXT        NOT NULL,
  -- 'cli' | 'ci_action' | 'ingest_run'
  source          TEXT        NOT NULL,
  -- verdict.evaluated_at — promoted for timeline ordering without JSON parsing
  evaluated_at    TIMESTAMPTZ NOT NULL,
  -- verdict.pass
  pass            BOOLEAN     NOT NULL,
  -- verdict.schema_version (e.g. '1.0')
  verdict_schema  TEXT        NOT NULL,
  -- full ConnectEvalVerdict as JSONB
  verdict         JSONB       NOT NULL,
  -- ConnectEvalDiff as JSONB, nullable (absent for absolute-bar runs without --baseline)
  diff            JSONB,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connect_eval_verdicts_workspace
  ON connect_eval_verdicts (workspace_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_connect_eval_verdicts_pass
  ON connect_eval_verdicts (workspace_id, pass, evaluated_at DESC);
