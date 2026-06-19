-- Transactional email SEND LOG — durable observability for every send the dashboard
-- performs (REC-PLAN-017 / founders-approval no-send incident).
--
-- WHY: before this, a send failure was caught fail-open and logged as an opaque error
-- name only ("ReferenceError"), with NO durable record and NO way for an operator to tell
-- whether a given email (e.g. a Founders Circle approval) ever sent. This table is the
-- system of record for "did email X to person Y send, and if not, why".
--
-- PII: recipient_masked stores a MASKED address only (e.g. "ad***@e***.com") — never the
--   raw recipient. error_reason stores a short, sanitised code/name only (never an SMTP
--   message that could echo the recipient). Do NOT log raw recipients or full SMTP errors
--   here or in application logs (security baseline: Founders Circle data must not hit logs).
--
-- ROLLBACK: DROP TABLE IF EXISTS email_send_log;

CREATE TABLE IF NOT EXISTS email_send_log (
  id            BIGSERIAL PRIMARY KEY,
  -- Logical message category, e.g. 'founders_approved', 'founders_apply_confirmation',
  -- 'founders_admin_notify', 'verification', 'password_reset', 'security_alert'.
  category      TEXT NOT NULL,
  -- Masked recipient (never raw). See PII note above.
  recipient_masked TEXT NOT NULL,
  -- Optional correlation key — for founders mail this is the normalised applicant email
  -- key so the admin UI can look up the last send for a given application WITHOUT storing
  -- the raw recipient in the hot path. NULL for non-founders mail.
  context_key   TEXT,
  success       BOOLEAN NOT NULL,
  -- Provider message-id on success (opaque, non-PII); short error code/name on failure.
  message_id    TEXT,
  error_reason  TEXT,
  sent_at_ms    BIGINT NOT NULL
);

-- Hot path: "last send for this founders applicant" (admin UI) — newest first.
CREATE INDEX IF NOT EXISTS idx_email_send_log_context
  ON email_send_log (context_key, sent_at_ms DESC);

-- Secondary: category timeline (ops review).
CREATE INDEX IF NOT EXISTS idx_email_send_log_category
  ON email_send_log (category, sent_at_ms DESC);
