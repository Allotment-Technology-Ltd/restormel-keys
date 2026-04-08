-- Mark auto-provisioned Restormel Testing project (one per workspace convention).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_restormel_testing BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_projects_workspace_testing ON projects (workspace_id) WHERE is_restormel_testing = true;
