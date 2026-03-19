-- Ingestion routing control plane additions (minimal stage + enriched step contract).
-- Additive migration: existing routes/steps continue to work with defaults.

-- ---------------------------------------------------------------------------
-- Routes: stage/workload binding + enable + minimal versioning placeholders
-- ---------------------------------------------------------------------------
ALTER TABLE routes ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS workload TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

-- Draft/publish lifecycle placeholders (not yet full snapshot versioning).
ALTER TABLE routes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS published_version INTEGER DEFAULT 1;

-- ---------------------------------------------------------------------------
-- Route steps: label + richer contract stored as JSON
-- ---------------------------------------------------------------------------
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS switch_criteria JSONB;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS retry_policy JSONB;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS cost_policy JSONB;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS notes TEXT;

-- Defaults / backfill: leave existing rows as null; keep order_index/policy fallback logic unchanged.

