-- Email preferences — the AUTHORITATIVE, sovereign marketing-consent ledger (REC-PLAN-017 Phase 3).
--
-- This table — NOT Brevo or any downstream send list — is the system of record for
-- whether a person has consented to each category of marketing email. Brevo (Phase 4)
-- is only a send list synced FROM here; it is never the source of truth. GDPR demands a
-- durable, queryable record of consent (lawful basis, source, timestamp) and of any
-- withdrawal — that record lives here. Transactional/security email is NOT governed by
-- this table (it has its own lawful basis: contract / legitimate interest) and cannot be
-- switched off here.
--
-- PII: email_preferences.email and email_preferences.user_id are personal data — do NOT
--   log raw values in application logs. unsub_token is a capability secret (grants the
--   ability to unsubscribe an address without auth) — treat as a credential, never log it.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS email_preferences;

CREATE TABLE IF NOT EXISTS email_preferences (
  -- Keyed by normalised (lower-cased, trimmed) email — the stable identity for an address
  -- that may receive marketing mail before/without an account. user_id is the linked
  -- account when known (nullable: an imported or pre-signup address has no account yet).
  email TEXT PRIMARY KEY,
  user_id TEXT,

  -- Per-category opt-in. Default FALSE = no consent until explicitly granted (opt-in by
  -- default, never opt-out). Transactional/security mail is intentionally absent: it is
  -- not a marketing category and is not user-suppressible here.
  product_updates BOOLEAN NOT NULL DEFAULT FALSE,
  newsletter BOOLEAN NOT NULL DEFAULT FALSE,
  release_notes BOOLEAN NOT NULL DEFAULT FALSE,

  -- How consent was obtained — the lawful-basis provenance for an audit/DSAR.
  --   soft-opt-in   : existing-customer soft opt-in (PECR reg.22(3)) for similar products
  --   double-opt-in : confirmed opt-in (clicked a confirmation link)
  --   import        : migrated from a prior system with its own recorded consent
  consent_source TEXT NOT NULL DEFAULT 'soft-opt-in'
    CHECK (consent_source IN ('soft-opt-in', 'double-opt-in', 'import')),

  -- When consent was first recorded; when the address last unsubscribed (NULL = subscribed).
  -- unsubscribed_at being non-NULL is the authoritative "suppressed" signal regardless of
  -- the per-category booleans (which are also cleared on unsubscribe, defence in depth).
  consent_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,

  -- Opaque, unique, high-entropy token embedded in one-click unsubscribe links
  -- (RFC 8058). Lets an address unsubscribe with no login. Rotated on each subscribe so a
  -- leaked old link cannot be replayed after re-subscription. NOT a password — capability only.
  unsub_token TEXT NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Account-scoped lookup (preference centre loads by the signed-in user's id).
CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id
  ON email_preferences (user_id);

-- Token lookup is the hot path for the public unsubscribe handler.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_preferences_unsub_token
  ON email_preferences (unsub_token);
