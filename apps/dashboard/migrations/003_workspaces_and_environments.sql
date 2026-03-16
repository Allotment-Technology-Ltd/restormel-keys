-- Workspace / Project / Environment hierarchy.
-- Run after 001_initial.sql and 002_better_auth.sql.
-- Backfills one workspace per user and dev/prod environments per project.

-- 1. Workspaces (one per user for first rollout)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id);

-- 2. Add workspace_id to projects (nullable until backfill)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;

-- 3. Backfill: one workspace per distinct user_id in projects, then set project.workspace_id
-- (No-op if projects is empty. Idempotent: only insert workspace if none exists for user.)
INSERT INTO workspaces (id, name, slug, owner_user_id, created_at)
SELECT
  gen_random_uuid()::text,
  'Default',
  'default',
  user_id,
  (SELECT min(created_at) FROM projects p2 WHERE p2.user_id = p.user_id)
FROM (SELECT DISTINCT user_id FROM projects) p
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.owner_user_id = p.user_id);

UPDATE projects
SET workspace_id = (SELECT id FROM workspaces w WHERE w.owner_user_id = projects.user_id ORDER BY created_at ASC LIMIT 1)
WHERE workspace_id IS NULL AND user_id IS NOT NULL;

-- Now enforce NOT NULL and index (safe after backfill; new projects get workspace_id from app)
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);

-- 4. Environments (dev, prod per project)
CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  CONSTRAINT fk_env_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_environments_project ON environments(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_environments_project_type ON environments(project_id, type);

-- 5. Backfill: dev and prod for each existing project (idempotent: skip if env for project+type exists)
INSERT INTO environments (id, project_id, name, type, created_at)
SELECT gen_random_uuid()::text, p.id, 'Development', 'dev', p.created_at
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM environments e WHERE e.project_id = p.id AND e.type = 'dev');

INSERT INTO environments (id, project_id, name, type, created_at)
SELECT gen_random_uuid()::text, p.id, 'Production', 'prod', p.created_at
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM environments e WHERE e.project_id = p.id AND e.type = 'prod');
