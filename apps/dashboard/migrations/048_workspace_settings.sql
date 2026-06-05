-- Workspace settings JSON (ingest quality telemetry opt-out, etc.)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
