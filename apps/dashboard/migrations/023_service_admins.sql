-- Service operators (Allotment Technology Ltd): exempt from subscription-style limits.
-- Populate via INSERT or use RESTORMEL_SERVICE_ADMIN_USER_IDS / Neon Auth user.role = admin.
-- ROLLBACK: DROP TABLE IF EXISTS service_admins;

CREATE TABLE IF NOT EXISTS service_admins (
  user_id TEXT PRIMARY KEY,
  note TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_admins_user ON service_admins(user_id);
