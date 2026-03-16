-- Control-plane schema: Gateway key extensions, provider integrations, models, routes, policies, audit, logs.
-- Run after 003_workspaces_and_environments.sql.
--
-- SECRETS: Provider credentials must NOT be stored in plaintext. provider_integrations.credential_ref
-- is an opaque reference (e.g. vault path or encrypted blob id). Raw secrets live in vault or
-- encrypted storage per docs/security-baseline.md.
--
-- ROLLBACK: To revert, drop tables in reverse order of creation (usage_aggregates, request_logs,
-- audit_events, policy_bindings, policies, route_steps, routes, provider_model_variants, models,
-- provider_bindings, provider_integrations, management_keys). Then drop added columns from api_keys
-- if desired (name, scope, status, created_by, last_used_at, expires_at, rotation_version).

-- ---------------------------------------------------------------------------
-- 1. Gateway keys: optional columns on api_keys (backward compatible)
-- ---------------------------------------------------------------------------
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at BIGINT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at BIGINT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rotation_version INTEGER DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. Management keys (PATs, workspace-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS management_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  role TEXT,
  scopes TEXT,
  status TEXT DEFAULT 'active',
  created_by TEXT,
  created_at BIGINT NOT NULL,
  last_used_at BIGINT,
  expires_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_management_keys_workspace ON management_keys(workspace_id);

-- ---------------------------------------------------------------------------
-- 3. Provider integrations (credential_ref only; no raw secrets)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_integrations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL,
  display_name TEXT,
  status TEXT DEFAULT 'active',
  verification_status TEXT,
  credential_ref TEXT,
  created_by TEXT,
  created_at BIGINT NOT NULL,
  last_verified_at BIGINT,
  metadata JSONB,
  region TEXT
);

CREATE INDEX IF NOT EXISTS idx_provider_integrations_workspace ON provider_integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_provider_integrations_type ON provider_integrations(provider_type);

-- ---------------------------------------------------------------------------
-- 4. Provider bindings (where a provider integration is allowed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_bindings (
  id TEXT PRIMARY KEY,
  provider_integration_id TEXT NOT NULL REFERENCES provider_integrations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id TEXT REFERENCES environments(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  usage_mode TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_bindings_integration ON provider_bindings(provider_integration_id);
CREATE INDEX IF NOT EXISTS idx_provider_bindings_project ON provider_bindings(project_id);

-- ---------------------------------------------------------------------------
-- 5. Models (canonical catalog; phased groundwork)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  family TEXT,
  lifecycle_state TEXT,
  description TEXT,
  modalities JSONB,
  capabilities JSONB,
  context_window INTEGER,
  max_output_tokens INTEGER,
  supports_tools BOOLEAN,
  supports_structured_output BOOLEAN,
  supports_mcp BOOLEAN,
  editorial_summary TEXT,
  strengths JSONB,
  weaknesses JSONB,
  recommended_for JSONB,
  avoid_for JSONB,
  deprecation_date BIGINT,
  retirement_date BIGINT,
  replacement_model_id TEXT REFERENCES models(id),
  source_last_verified_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_models_lifecycle ON models(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_models_canonical_name ON models(canonical_name);

-- ---------------------------------------------------------------------------
-- 6. Provider model variants (provider-specific view of a model)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_model_variants (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  provider_integration_type TEXT NOT NULL,
  provider_model_id TEXT NOT NULL,
  availability_status TEXT,
  pricing_ref TEXT,
  rate_limit_ref TEXT,
  metadata JSONB,
  source_last_verified_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_provider_model_variants_model ON provider_model_variants(model_id);

-- ---------------------------------------------------------------------------
-- 7. Routes (project/environment-scoped; phased groundwork)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_model_id TEXT REFERENCES models(id),
  billing_mode TEXT,
  route_mode TEXT,
  status TEXT DEFAULT 'active',
  created_by TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_routes_project ON routes(project_id);
CREATE INDEX IF NOT EXISTS idx_routes_environment ON routes(environment_id);

-- ---------------------------------------------------------------------------
-- 8. Route steps (ordered routing logic; phased groundwork)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_steps (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  provider_preference TEXT,
  model_id TEXT REFERENCES models(id),
  condition_block JSONB,
  fallback_on TEXT,
  timeout_ms INTEGER,
  enabled BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_route_steps_route ON route_steps(route_id);

-- ---------------------------------------------------------------------------
-- 9. Policies (workspace-scoped; phased groundwork)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  rule_definition JSONB,
  created_by TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policies_workspace ON policies(workspace_id);

-- ---------------------------------------------------------------------------
-- 10. Policy bindings (attach policy to target; phased groundwork)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS policy_bindings (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_bindings_policy ON policy_bindings(policy_id);

-- ---------------------------------------------------------------------------
-- 11. Audit events (used by key create/revoke; immediate use)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  summary TEXT,
  created_at BIGINT NOT NULL,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_events_workspace ON audit_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_target ON audit_events(target_type, target_id);

-- ---------------------------------------------------------------------------
-- 12. Request logs (phased groundwork; ingestion from gateway later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  route_id TEXT,
  gateway_key_id TEXT,
  customer_tenant_id TEXT,
  provider_type TEXT NOT NULL,
  provider_model_variant_id TEXT,
  final_model_id TEXT,
  request_status TEXT NOT NULL,
  latency_ms BIGINT NOT NULL,
  ttft_ms BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  cached_tokens BIGINT,
  estimated_cost REAL,
  fallback_count INTEGER,
  error_code TEXT,
  created_at BIGINT NOT NULL,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_request_logs_workspace_created ON request_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_project_created ON request_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_route ON request_logs(route_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 13. Usage aggregates (phased groundwork; aggregation job later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_aggregates (
  id TEXT PRIMARY KEY,
  granularity TEXT NOT NULL,
  period_start BIGINT NOT NULL,
  period_end BIGINT NOT NULL,
  workspace_id TEXT,
  project_id TEXT,
  environment_id TEXT,
  route_id TEXT,
  gateway_key_id TEXT,
  customer_tenant_id TEXT,
  provider_type TEXT,
  model_id TEXT,
  request_count BIGINT NOT NULL DEFAULT 0,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  cached_tokens BIGINT DEFAULT 0,
  estimated_cost REAL,
  avg_latency_ms REAL,
  error_rate REAL,
  fallback_rate REAL
);

CREATE INDEX IF NOT EXISTS idx_usage_aggregates_period ON usage_aggregates(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_aggregates_workspace ON usage_aggregates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_usage_aggregates_project ON usage_aggregates(project_id);
