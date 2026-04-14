-- Phase F: model pools per step + optional parallel group metadata (contract 2026-04-16+).
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS model_pool JSONB;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS parallel_group_id TEXT;
ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS parallel_branch_role TEXT;
