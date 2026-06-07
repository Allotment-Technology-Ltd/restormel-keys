-- Public Connect ingest webhooks (I1). Distinct from workspace_webhooks (operator
-- policy.published): these are workspace-scoped, registered via the public
-- /connect/v1/webhooks API, and fired when an ingest job reaches a terminal state.
-- Signing secrets are encrypted at rest like provider credentials.
-- TEXT ids/workspace_id match workspaces.id and the rest of the dashboard schema.
CREATE TABLE IF NOT EXISTS connect_webhooks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT,
  url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '["job.completed"]',
  quality_threshold DOUBLE PRECISION,
  signing_secret_ciphertext TEXT,
  signing_secret_iv TEXT,
  signing_secret_auth_tag TEXT,
  signing_secret_encryption_version INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_connect_webhooks_workspace ON connect_webhooks(workspace_id);

-- Delivery attempts (fire-and-forget; 3 attempts with exponential backoff).
CREATE TABLE IF NOT EXISTS connect_webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES connect_webhooks(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  job_id TEXT,
  event TEXT NOT NULL,
  attempt INT NOT NULL,
  ok BOOLEAN NOT NULL,
  status_code INT,
  error TEXT,
  duration_ms INT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_connect_webhook_deliveries_webhook
  ON connect_webhook_deliveries(webhook_id, created_at DESC);
