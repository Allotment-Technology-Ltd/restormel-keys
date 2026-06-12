-- Stage R7 (decision D4 — Workspace infrastructure project): mark the auto-provisioned
-- Connect-owned routing project (one per workspace convention, mirroring 026's
-- is_restormel_testing flag for the Testing project).
--
-- Created on first Connect flow entry when the workspace has no stage-routing config;
-- becomes the routing config's default project so provider bindings and stage routes
-- have a deliberate, visible home instead of whichever project the user happened to
-- have (KEYS K-P0-2's "works by coincidence on the Testing project" trap).
--
-- Rollback: ALTER TABLE projects DROP COLUMN IF EXISTS is_connect_infrastructure;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_connect_infrastructure BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_projects_workspace_connect_infra ON projects (workspace_id) WHERE is_connect_infrastructure = true;
