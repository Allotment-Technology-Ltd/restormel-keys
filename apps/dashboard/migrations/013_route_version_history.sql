-- Route version history for publish/rollback lifecycle.
-- Stores route + step snapshots to enable deterministic rollback.

CREATE TABLE IF NOT EXISTS route_version_events (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_type TEXT,
  summary TEXT,
  route_snapshot JSONB,
  steps_snapshot JSONB,
  metadata JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_route_version_events_route_created
  ON route_version_events(route_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_version_events_project_route_version
  ON route_version_events(project_id, route_id, version);

