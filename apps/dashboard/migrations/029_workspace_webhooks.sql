-- Outbound webhooks per workspace (MVP: policy.published). Signing secrets encrypted like provider credentials.
-- id/workspace_id are TEXT to match workspaces.id and the rest of the dashboard schema (003_workspaces_and_environments.sql).
CREATE TABLE IF NOT EXISTS workspace_webhooks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  event_types TEXT NOT NULL DEFAULT '["policy.published"]',
  signing_secret_ciphertext TEXT,
  signing_secret_iv TEXT,
  signing_secret_auth_tag TEXT,
  signing_secret_encryption_version INT NOT NULL DEFAULT 0,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_webhooks_workspace ON workspace_webhooks(workspace_id);
