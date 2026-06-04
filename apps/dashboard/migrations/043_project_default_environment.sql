-- Phase 4b: canonical default environment per project (MVP when environments module off).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_environment_id TEXT REFERENCES environments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_default_environment ON projects(default_environment_id);

-- Backfill prod-canonical default where environments exist.
UPDATE projects p
SET default_environment_id = e.id
FROM environments e
WHERE e.project_id = p.id
  AND e.type = 'prod'
  AND p.default_environment_id IS NULL;

UPDATE projects p
SET default_environment_id = sub.id
FROM (
  SELECT DISTINCT ON (project_id) id, project_id
  FROM environments
  ORDER BY project_id, created_at ASC
) sub
WHERE p.id = sub.project_id
  AND p.default_environment_id IS NULL;
