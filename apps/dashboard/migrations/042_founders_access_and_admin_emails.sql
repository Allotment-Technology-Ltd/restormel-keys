-- Founders Circle email gate + operator email grants (admin UI).
-- PII: founders_circle_access.email — do not log raw values in application logs.
-- ROLLBACK:
--   DROP TABLE IF EXISTS service_admin_emails;
--   DROP TABLE IF EXISTS founders_circle_access;

CREATE TABLE IF NOT EXISTS founders_circle_access (
  email TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  application_id TEXT REFERENCES founders_applications (id) ON DELETE SET NULL,
  applicant_name TEXT,
  submitted_at_ms BIGINT,
  reviewed_at_ms BIGINT,
  reviewed_by_user_id TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_founders_circle_access_status
  ON founders_circle_access (status, submitted_at_ms DESC);

CREATE TABLE IF NOT EXISTS service_admin_emails (
  email TEXT PRIMARY KEY,
  created_at_ms BIGINT NOT NULL,
  created_by_user_id TEXT,
  note TEXT
);

-- Backfill pending rows from existing applications (email from JSON payload).
INSERT INTO founders_circle_access (email, status, application_id, applicant_name, submitted_at_ms)
SELECT
  lower(trim(payload->>'email')),
  'pending',
  id,
  nullif(trim(payload->>'name'), ''),
  submitted_at_ms
FROM founders_applications
WHERE payload->>'email' IS NOT NULL
  AND trim(payload->>'email') <> ''
ON CONFLICT (email) DO NOTHING;
