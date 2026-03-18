-- Workspace plan + minimal billing references (two-tier: free/pro).
-- Additive, safe migration.

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan_updated_at BIGINT;

-- Optional references for billing reconciliation (no secrets; IDs only).
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS paddle_transaction_id TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS paddle_subscription_status TEXT;

