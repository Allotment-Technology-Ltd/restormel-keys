-- Provenance columns for routes/policies and policy lifecycle snapshots.

ALTER TABLE routes ADD COLUMN IF NOT EXISTS updated_via TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS change_summary TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE policies ADD COLUMN IF NOT EXISTS updated_at BIGINT;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS updated_via TEXT;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS change_summary TEXT;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS content_hash TEXT;

UPDATE policies
SET updated_at = COALESCE(updated_at, created_at)
WHERE updated_at IS NULL;

ALTER TABLE policies ALTER COLUMN updated_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS policy_version_events (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_type TEXT,
  summary TEXT,
  policy_snapshot JSONB,
  metadata JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_version_events_policy_created
  ON policy_version_events(policy_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_version_events_workspace_policy_version
  ON policy_version_events(workspace_id, policy_id, version);
