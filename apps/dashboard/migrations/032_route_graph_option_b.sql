-- Option B: control-plane routing graph (edges + layout + entry) for visual flow builder.
-- Resolver falls back to linear orderIndex when a route has no edges.

ALTER TABLE routes ADD COLUMN IF NOT EXISTS entry_step_id TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS flow_layout JSONB;

-- Optional FK: entry must reference a step on this route (enforced in app on save).
-- We avoid a hard FK cycle with routes↔steps creation order; validate in API.

CREATE TABLE IF NOT EXISTS route_step_edges (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  from_step_id TEXT NOT NULL REFERENCES route_steps(id) ON DELETE CASCADE,
  to_step_id TEXT NOT NULL REFERENCES route_steps(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  created_at BIGINT NOT NULL,
  CONSTRAINT route_step_edges_unique_transition UNIQUE (route_id, from_step_id, to_step_id)
);

CREATE INDEX IF NOT EXISTS idx_route_step_edges_route_from
  ON route_step_edges(route_id, from_step_id);
