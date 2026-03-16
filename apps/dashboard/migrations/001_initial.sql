-- Neon / Postgres schema for dashboard (projects + api_keys).
-- Auth tables (user, session, account, verification) are created by Better Auth migration 002_better_auth.sql.
-- Run 001 then 002, or run npx auth@latest migrate after 001 (with DATABASE_URL set).

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_project_created ON api_keys(project_id, created_at DESC);
