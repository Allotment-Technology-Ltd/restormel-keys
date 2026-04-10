-- App-level users mirror (id + email) used by upsertUser in hooks; optional for Neon Auth deployments.
-- ROLLBACK: DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users ((lower(email)));
