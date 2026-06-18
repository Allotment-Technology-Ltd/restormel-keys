-- Migration 070: Graph Library columns on knowledge_graph_targets (prod schema-drift fix).
--
-- ROOT CAUSE (incident 2026-06-18-prod-add-graph-500): the Graph Library feature
-- writes `label`, `default_domain_pack_id` and `settings` to knowledge_graph_targets
-- and allows MANY saved graphs per workspace (it DROPs the single-graph UNIQUE
-- constraint). Those four schema changes were only ever expressed as RUNTIME DDL
-- inside ensureIngestionRoutingSchema() (neon.ts). Runtime DDL is DISABLED in
-- production (CONNECT_RUNTIME_DDL=0 via NODE_ENV=production), so prod's table —
-- created by 036 and only extended by 038 (use_dashboard_database) — was MISSING
-- these columns. Every "Add a graph" INSERT referenced non-existent columns and
-- threw `column "..." does not exist`, surfacing as an uncaught HTTP 500
-- ("Internal Error"). Surreal + credentials were fine; the throw was the Neon INSERT.
--
-- This migration brings the prod schema to parity with the code's expectation,
-- mirroring the runtime DDL EXACTLY (neon.ts ~2760-2767). Idempotent and safe to
-- re-run. After this, REQUIRED_MIGRATION is bumped to 070 so the drift gate fails
-- loudly at deploy/boot if it is ever missing again.

-- Graph Library: a human label for each saved graph (defaults to "ns/db" in code).
ALTER TABLE knowledge_graph_targets ADD COLUMN IF NOT EXISTS label TEXT;

-- The domain pack whose schema/ontology travels with this graph when it is activated.
-- ON DELETE SET NULL: deleting a pack must not delete the graph connection.
ALTER TABLE knowledge_graph_targets
  ADD COLUMN IF NOT EXISTS default_domain_pack_id TEXT
  REFERENCES knowledge_domain_packs(id) ON DELETE SET NULL;

-- Settings JSONB carries per-graph bundle state (ingest_document_ids,
-- default_stop_after_stage, allow_claim_versions_table). NOT NULL DEFAULT '{}'.
ALTER TABLE knowledge_graph_targets
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Graph Library allows many saved graphs per workspace (one active at a time), so
-- the original one-graph-per-workspace UNIQUE constraint from 036 must be dropped.
-- Without this, saving a SECOND graph fails even when no domain pack is selected.
ALTER TABLE knowledge_graph_targets
  DROP CONSTRAINT IF EXISTS knowledge_graph_targets_workspace_unique;

-- Hot path: list a workspace's graphs newest-first.
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_targets_workspace
  ON knowledge_graph_targets (workspace_id, updated_at DESC);
