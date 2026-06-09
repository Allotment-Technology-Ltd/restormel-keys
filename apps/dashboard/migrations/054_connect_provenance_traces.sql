-- Provenance audit traces for Connect v1 retrieval (Stage 4B).
-- Every POST /connect/v1/retrieve and /connect/v1/graph query stores a versioned
-- ProvenanceTrace document keyed by trace_id. 90-day retention enforced by expires_at
-- (filtered on read; pruned by a future cron). The full trace lives in `trace` (JSONB);
-- the flat columns are denormalised for cheap listing/auth without parsing the document.
CREATE TABLE IF NOT EXISTS connect_provenance_traces (
  trace_id          TEXT        PRIMARY KEY,
  workspace_id      TEXT        NOT NULL,
  project_id        TEXT,
  query             TEXT        NOT NULL,
  domain_pack       TEXT        NOT NULL,
  graph_store_type  TEXT        NOT NULL,
  schema_version    TEXT        NOT NULL,
  trace             JSONB       NOT NULL,
  queried_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '90 days'
);

CREATE INDEX IF NOT EXISTS idx_connect_provenance_traces_workspace
  ON connect_provenance_traces (workspace_id, queried_at DESC);

CREATE INDEX IF NOT EXISTS idx_connect_provenance_traces_expires
  ON connect_provenance_traces (expires_at);
