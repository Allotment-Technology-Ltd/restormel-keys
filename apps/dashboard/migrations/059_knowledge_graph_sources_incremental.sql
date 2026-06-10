-- Stage 3.2 incremental re-ingest (docs/decisions/verified-memory-incremental-ingest.md).
-- A source's stable identity (source_key: canonical url / url / normalized title) plus
-- the content hash of the version that was ingested let a re-ingest:
--   1. skip an UNCHANGED document entirely (hash match ⇒ zero model calls; the only
--      write is a last_seen_at touch), and
--   2. find the prior source row's current claim versions to diff against (carried /
--      changed / added / removed) when the hash DID change.
-- created_at/last_seen_at follow this table's existing epoch-millis BIGINT convention.
ALTER TABLE knowledge_graph_sources ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE knowledge_graph_sources ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE knowledge_graph_sources ADD COLUMN IF NOT EXISTS last_seen_at BIGINT;

CREATE INDEX IF NOT EXISTS idx_knowledge_graph_sources_source_key
  ON knowledge_graph_sources (workspace_id, source_key, created_at DESC)
  WHERE source_key IS NOT NULL;
