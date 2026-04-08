-- Map ref:restormel-keys:… logical refs to project model bindings for Testing resolve.
ALTER TABLE project_model_bindings
  ADD COLUMN IF NOT EXISTS keys_logical_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_model_bindings_keys_logical_ref
  ON project_model_bindings (project_id, keys_logical_ref)
  WHERE keys_logical_ref IS NOT NULL;
