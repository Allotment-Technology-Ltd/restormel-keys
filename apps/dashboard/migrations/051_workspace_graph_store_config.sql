-- Multi-database graph store support (Build 1C — GraphStoreAdapter foundation).
-- Nullable JSONB holding the workspace's GraphStoreConnectionConfig
-- (type, endpoint/connectionString, encrypted credentials, schemaMode, mappings).
-- NULL means "no explicit config" → AdapterFactory defaults to SurrealDB (fresh),
-- preserving behaviour for existing workspaces (see risk 3 in
-- docs/requirements/graph_store_adapter_architecture.md). UI wiring lands with
-- multi-DB Sprint 1 (Build 2A).
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS graph_store_config JSONB;
