-- Knowledge pipeline profiles: saved configurations (domain pack + graph target + defaults)
-- so an operator can "configure once, run many times" for their corpus.

CREATE TABLE IF NOT EXISTS knowledge_pipeline_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  domain_pack_id TEXT NOT NULL REFERENCES knowledge_domain_packs(id) ON DELETE CASCADE,
  graph_target_id TEXT REFERENCES knowledge_graph_targets(id) ON DELETE SET NULL,
  default_stop_after_stage TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_pipeline_profiles_workspace
  ON knowledge_pipeline_profiles (workspace_id, updated_at DESC);
