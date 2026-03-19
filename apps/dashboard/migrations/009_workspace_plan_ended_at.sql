-- When Pro ended (downgrade or cancellation). Enables "when did they lapse/cancel" in reporting.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan_ended_at BIGINT;

COMMENT ON COLUMN workspaces.plan_ended_at IS 'Unix ms when Pro was downgraded or cancelled; set on expiry downgrade or Paddle subscription cancel.';
