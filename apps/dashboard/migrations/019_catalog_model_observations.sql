-- 019_catalog_model_observations.sql
-- Aggregated crowd reports when downstream apps observe provider signals (e.g. deprecated model).

CREATE TABLE IF NOT EXISTS catalog_model_observations (
  catalog_provider_id TEXT NOT NULL,
  provider_model_id TEXT NOT NULL,
  deprecated_report_count INTEGER NOT NULL DEFAULT 0,
  retired_report_count INTEGER NOT NULL DEFAULT 0,
  first_reported_at BIGINT,
  last_reported_at BIGINT,
  last_report_workspace_id TEXT,
  last_provider_http_status INTEGER,
  last_provider_error_code TEXT,
  PRIMARY KEY (catalog_provider_id, provider_model_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_model_observations_last_reported
  ON catalog_model_observations(last_reported_at DESC);
