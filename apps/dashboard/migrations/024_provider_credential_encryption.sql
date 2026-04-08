-- Encrypted provider credentials for Connections (AES-256-GCM ciphertext; key from RESTORMEL_CREDENTIALS_ENCRYPTION_KEY).
-- credential_ref remains for optional non-secret labels / legacy references only.

ALTER TABLE provider_integrations
  ADD COLUMN IF NOT EXISTS credential_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS credential_iv TEXT,
  ADD COLUMN IF NOT EXISTS credential_auth_tag TEXT,
  ADD COLUMN IF NOT EXISTS credential_encryption_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS secret_display_suffix TEXT;

COMMENT ON COLUMN provider_integrations.credential_ciphertext IS 'Base64 AES-256-GCM ciphertext; never log';
COMMENT ON COLUMN provider_integrations.credential_iv IS 'Base64 IV';
COMMENT ON COLUMN provider_integrations.credential_auth_tag IS 'Base64 GCM auth tag';
COMMENT ON COLUMN provider_integrations.secret_display_suffix IS 'Last 4 chars of secret for display; optional prefix in metadata';
