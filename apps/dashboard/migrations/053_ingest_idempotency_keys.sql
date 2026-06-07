-- Idempotency keys for POST /connect/v1/ingest/jobs (Stage 2C).
-- Keyed on (workspace_id, idempotency_key); TTL enforced by expires_at.
CREATE TABLE IF NOT EXISTS connect_ingest_idempotency_keys (
  workspace_id        TEXT        NOT NULL,
  idempotency_key     TEXT        NOT NULL,
  response_status     INT         NOT NULL,
  response_body       JSONB       NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_connect_ingest_idempotency_keys_expires
  ON connect_ingest_idempotency_keys (expires_at);
