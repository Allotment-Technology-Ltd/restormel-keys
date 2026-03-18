-- Pro access with optional expiry (founding promo: first N users get time-limited Pro).
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan_expires_at BIGINT;

COMMENT ON COLUMN workspaces.plan_expires_at IS 'Unix ms when Pro reverts to Free if set; NULL = Pro without calendar expiry (e.g. paid).';

-- Backfill: first 50 Better Auth users (by signup time) on free workspaces → 12 months Pro.
-- Skips workspaces already on Pro with billing refs (paid).
UPDATE workspaces w
SET
  plan = 'pro',
  plan_updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
  plan_expires_at = (EXTRACT(EPOCH FROM (NOW() + INTERVAL '12 months')) * 1000)::bigint
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "user"
) u
WHERE w.owner_user_id = u.id
  AND u.rn <= 50
  AND w.plan = 'free'
  AND (w.paddle_subscription_id IS NULL OR w.paddle_subscription_id = '')
  AND (w.paddle_customer_id IS NULL OR w.paddle_customer_id = '');
