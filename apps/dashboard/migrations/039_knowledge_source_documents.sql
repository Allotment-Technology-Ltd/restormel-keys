-- Knowledge source documents: normalized, parsed documents that operators add
-- (upload / URL now; S3 / Google Drive / SharePoint connectors later) and then
-- select when creating ingest jobs. Stores the parsed text + chunk metadata.

CREATE TABLE IF NOT EXISTS knowledge_source_documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT,
  url TEXT,
  text TEXT,
  char_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'parsed',
  error TEXT,
  parser_provider TEXT,
  created_at BIGINT NOT NULL,
  CONSTRAINT knowledge_source_documents_status_check CHECK (status IN ('parsed', 'failed', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_source_documents_workspace
  ON knowledge_source_documents (workspace_id, created_at DESC);

-- Source connections (OAuth/credentialed) for cloud connectors — created now,
-- exercised by Phase B (S3 / Google Drive / SharePoint).
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT,
  config JSONB,
  secret_ciphertext TEXT,
  secret_iv TEXT,
  secret_auth_tag TEXT,
  secret_encryption_version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'untested',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_workspace
  ON knowledge_sources (workspace_id, updated_at DESC);
