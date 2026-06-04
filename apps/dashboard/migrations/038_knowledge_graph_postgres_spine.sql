-- Knowledge graph store: add Postgres/Neon as an alternative provider to Surreal.
-- The one-click option reuses the dashboard's own Neon connection (use_dashboard_database),
-- so no connection fields/credentials are required.

ALTER TABLE knowledge_graph_targets
  ADD COLUMN IF NOT EXISTS use_dashboard_database BOOLEAN NOT NULL DEFAULT false;

-- Postgres-dashboard targets carry no endpoint/namespace/database.
ALTER TABLE knowledge_graph_targets ALTER COLUMN endpoint DROP NOT NULL;
ALTER TABLE knowledge_graph_targets ALTER COLUMN namespace DROP NOT NULL;
ALTER TABLE knowledge_graph_targets ALTER COLUMN database DROP NOT NULL;

-- Workspace-scoped, domain-agnostic graph spine in Postgres. The domain pack
-- supplies vocabulary; these tables store the structure for any domain.
CREATE TABLE IF NOT EXISTS knowledge_graph_sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain_pack_id TEXT,
  job_id TEXT,
  title TEXT,
  url TEXT,
  text_preview TEXT,
  source_kind TEXT,
  payload JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_graph_sources_workspace
  ON knowledge_graph_sources (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_graph_units (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain_pack_id TEXT,
  source_id TEXT,
  unit_type TEXT,
  domain TEXT,
  text TEXT NOT NULL,
  embedding JSONB,
  payload JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_graph_units_workspace
  ON knowledge_graph_units (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_graph_relations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain_pack_id TEXT,
  from_unit_id TEXT NOT NULL,
  to_unit_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  payload JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_graph_relations_workspace
  ON knowledge_graph_relations (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_graph_groups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain_pack_id TEXT,
  name TEXT,
  summary TEXT,
  payload JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_graph_groups_workspace
  ON knowledge_graph_groups (workspace_id, created_at DESC);
