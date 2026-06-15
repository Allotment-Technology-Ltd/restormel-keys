-- Migration 069: verifying-proxy upstream MCP target registration (REC-PLAN-010 / W2-2 Phase B).
--
-- Per-workspace registration of a user's own upstream MCP server, modelled on
-- knowledge_graph_targets (encrypted secret at rest, connection-as-boundary).
-- Flag-gated at the application layer (RESTORMEL_VERIFYING_PROXY); this table is
-- inert until the proxy is enabled. No remote/unauth route reads it (Phase B is
-- local→staging only).
--
-- Cross-row uniqueness guard (D-d): a single physical upstream
-- (endpoint, namespace, database) may be registered by at most ONE workspace, so
-- two tenants can never resolve the same backing server. namespace/database are
-- nullable for HTTP-only upstreams; COALESCE'd to '' in the unique index so NULLs
-- collapse to a single logical key (Postgres treats NULLs as distinct otherwise).

CREATE TABLE IF NOT EXISTS upstream_mcp_targets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label TEXT,
  transport TEXT NOT NULL DEFAULT 'streamable-http',
  endpoint TEXT NOT NULL,
  namespace TEXT,
  database TEXT,
  secret_ciphertext TEXT,
  secret_iv TEXT,
  secret_auth_tag TEXT,
  secret_encryption_version INTEGER NOT NULL DEFAULT 0,
  allowed_tools JSONB,
  status TEXT NOT NULL DEFAULT 'untested',
  last_tested_at BIGINT,
  last_error TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT upstream_mcp_targets_transport_check CHECK (transport IN ('streamable-http', 'stdio')),
  CONSTRAINT upstream_mcp_targets_status_check CHECK (status IN ('untested', 'ok', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_upstream_mcp_targets_workspace
  ON upstream_mcp_targets (workspace_id, updated_at DESC);

-- Cross-row uniqueness on the normalised physical upstream identity. Lower-cased
-- endpoint with any trailing slash stripped, NULL namespace/database collapsed to ''.
-- This is the DB-level half of the workspace-isolation guard; the service layer
-- raises `upstream_scope_conflict` before reaching here for a clear error.
CREATE UNIQUE INDEX IF NOT EXISTS uq_upstream_mcp_targets_physical
  ON upstream_mcp_targets (
    lower(rtrim(endpoint, '/')),
    COALESCE(namespace, ''),
    COALESCE(database, '')
  );
