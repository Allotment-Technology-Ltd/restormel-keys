-- OAuth 2.0 device-authorization-style CLI linking (RFC 8628 patterns).
-- Ephemeral rows: pending_raw_key cleared on first successful poll; rows cleaned on start.
-- ROLLBACK: DROP TABLE IF EXISTS cli_device_sessions;

CREATE TABLE IF NOT EXISTS cli_device_sessions (
  id TEXT PRIMARY KEY,
  device_code_hash TEXT NOT NULL UNIQUE,
  user_code TEXT NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  interval_ms INTEGER NOT NULL DEFAULT 5000,
  status TEXT NOT NULL DEFAULT 'pending',
  authorized_at BIGINT,
  consumed_at BIGINT,
  user_id TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  api_key_id TEXT,
  pending_raw_key TEXT,
  result_key_prefix TEXT,
  created_at BIGINT NOT NULL,
  request_ip TEXT,
  last_poll_at BIGINT,
  poll_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cli_device_expires ON cli_device_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_cli_device_user_code_pending ON cli_device_sessions(user_code) WHERE status = 'pending';
