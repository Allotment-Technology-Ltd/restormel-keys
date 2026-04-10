-- Founders Circle applications: durable store when webhook is unset or for operational replay.
-- Payload may contain PII (name, email). Do not log raw payload; retention per docs/security-baseline.md.
-- ROLLBACK: DROP TABLE IF EXISTS founders_applications;

CREATE TABLE IF NOT EXISTS founders_applications (
  id TEXT PRIMARY KEY,
  submitted_at_ms BIGINT NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_founders_applications_submitted ON founders_applications (submitted_at_ms);
