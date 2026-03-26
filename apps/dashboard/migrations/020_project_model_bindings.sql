-- Project-scoped model index for selectors / host merges (Gateway Key + session).
-- Canonical provider_type matches resolve JSON (e.g. vertex, openai, voyage).

CREATE TABLE IF NOT EXISTS project_model_bindings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT uq_project_model_binding UNIQUE (project_id, provider_type, model_id)
);

CREATE INDEX IF NOT EXISTS idx_project_model_bindings_project
  ON project_model_bindings(project_id);

CREATE INDEX IF NOT EXISTS idx_project_model_bindings_project_enabled
  ON project_model_bindings(project_id, enabled);
