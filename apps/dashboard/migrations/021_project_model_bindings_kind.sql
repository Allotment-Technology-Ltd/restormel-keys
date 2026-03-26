-- Project model index: execution vs registry rows (no FK to models for registry / off-catalog ids).
-- Registry bindings store arbitrary providerType + modelId for host merge metadata; execution keeps app-level catalog validation.

ALTER TABLE project_model_bindings
  ADD COLUMN IF NOT EXISTS binding_kind TEXT NOT NULL DEFAULT 'execution';

ALTER TABLE project_model_bindings
  DROP CONSTRAINT IF EXISTS project_model_bindings_model_id_fkey;
