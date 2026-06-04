-- Later pipeline stages writing into the Postgres graph spine:
-- grouping (group membership with roles) and validation (per-unit faithfulness).
-- Embeddings reuse the existing knowledge_graph_units.embedding JSONB column.

CREATE TABLE IF NOT EXISTS knowledge_graph_group_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES knowledge_graph_groups(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES knowledge_graph_units(id) ON DELETE CASCADE,
  role TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_graph_group_members_group
  ON knowledge_graph_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_group_members_unit
  ON knowledge_graph_group_members (unit_id);

ALTER TABLE knowledge_graph_units
  ADD COLUMN IF NOT EXISTS validation_status TEXT,
  ADD COLUMN IF NOT EXISTS validation_note TEXT;
