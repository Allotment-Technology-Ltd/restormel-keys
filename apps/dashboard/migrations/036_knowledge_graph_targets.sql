-- Knowledge ingestion configuration: Bring-Your-Own graph store targets + domain packs.
-- Makes the ingestion pipeline domain-agnostic (ported/generalised from SOPHIA's
-- philosophy-only pipeline). Connection secrets are AES-256-GCM encrypted
-- (key from RESTORMEL_CREDENTIALS_ENCRYPTION_KEY); never store plaintext.

CREATE TABLE IF NOT EXISTS knowledge_graph_targets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'surreal',
  endpoint TEXT NOT NULL,
  namespace TEXT NOT NULL,
  database TEXT NOT NULL,
  username TEXT,
  -- Encrypted secret (password/token)
  secret_ciphertext TEXT,
  secret_iv TEXT,
  secret_auth_tag TEXT,
  secret_encryption_version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'untested',
  last_tested_at BIGINT,
  last_error TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT knowledge_graph_targets_status_check CHECK (status IN ('untested', 'ok', 'error')),
  CONSTRAINT knowledge_graph_targets_workspace_unique UNIQUE (workspace_id)
);

COMMENT ON COLUMN knowledge_graph_targets.secret_ciphertext IS 'Base64 AES-256-GCM ciphertext; never log';

-- Domain packs: customisable ontology + prompts + graph schema map per workspace.
CREATE TABLE IF NOT EXISTS knowledge_domain_packs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  ontology JSONB NOT NULL,
  prompts JSONB NOT NULL DEFAULT '{}'::jsonb,
  graph_schema JSONB NOT NULL,
  passage_profile JSONB NOT NULL,
  entity_linking JSONB,
  embedding JSONB NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT knowledge_domain_packs_workspace_slug_unique UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_domain_packs_workspace
  ON knowledge_domain_packs (workspace_id, updated_at DESC);

-- Job provenance: which configuration a job was created against.
ALTER TABLE knowledge_ingest_jobs
  ADD COLUMN IF NOT EXISTS pipeline_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS domain_pack_id TEXT,
  ADD COLUMN IF NOT EXISTS graph_target_id TEXT;
