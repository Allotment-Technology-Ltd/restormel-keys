-- Add created_at/updated_at timestamps to route_steps (backfill existing rows).
-- Safe, additive migration.

ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS created_at BIGINT;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS updated_at BIGINT;

-- Backfill for existing rows
UPDATE route_steps
SET
  created_at = COALESCE(created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint),
  updated_at = COALESCE(updated_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint);

ALTER TABLE route_steps ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE route_steps ALTER COLUMN updated_at SET NOT NULL;

