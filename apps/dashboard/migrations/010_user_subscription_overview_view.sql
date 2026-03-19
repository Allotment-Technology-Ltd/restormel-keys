-- View for Neon Console: subscription level, renewal/expiry, and status per workspace.
-- Uses only workspaces (no join to "user") so it works when auth tables are in another schema or DB (e.g. Neon Auth).
-- user_id below is owner_user_id; join to your user store elsewhere if you need name/email/joined_at.

CREATE OR REPLACE VIEW user_subscription_overview AS
SELECT
  w.owner_user_id AS user_id,
  w.id AS workspace_id,
  w.plan AS subscription_plan,
  w.plan_updated_at,
  w.plan_expires_at AS renewal_or_expiry_at,
  CASE
    WHEN w.plan_expires_at IS NOT NULL THEN to_timestamp(w.plan_expires_at / 1000.0) AT TIME ZONE 'UTC'
    ELSE NULL
  END::timestamptz AS renewal_or_expiry_at_utc,
  w.plan_ended_at,
  CASE
    WHEN w.plan_ended_at IS NOT NULL THEN to_timestamp(w.plan_ended_at / 1000.0) AT TIME ZONE 'UTC'
    ELSE NULL
  END::timestamptz AS plan_ended_at_utc,
  w.paddle_subscription_id,
  w.paddle_subscription_status,
  w.paddle_customer_id,
  CASE
    WHEN w.paddle_subscription_status IN ('cancelled', 'canceled', 'past_due') THEN w.paddle_subscription_status
    WHEN w.plan = 'pro' AND w.plan_expires_at IS NOT NULL AND w.plan_expires_at <= (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint THEN 'expired'
    WHEN w.plan = 'pro' THEN 'active'
    WHEN w.plan_ended_at IS NOT NULL THEN 'lapsed'
    ELSE 'free'
  END AS subscription_state
FROM workspaces w;

COMMENT ON VIEW user_subscription_overview IS 'Read-only: subscription level, renewal/expiry, ended-at, and state per workspace. user_id = owner_user_id. For Neon Console or reporting.';
