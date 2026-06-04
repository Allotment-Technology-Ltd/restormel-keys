-- Per-stage LLM model fallback chains for Knowledge ingestion (workspace-scoped).
-- config JSONB: { extraction: string[], grouping: [], validation: [], remediation: [], embedding: [] }

CREATE TABLE IF NOT EXISTS knowledge_stage_models (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at BIGINT NOT NULL
);
