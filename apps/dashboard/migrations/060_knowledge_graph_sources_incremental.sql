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

-- Backfill: derive source_key for pre-3.2 rows so their claim generations participate in
-- the re-ingest diff (otherwise an old generation would be silently kept alongside the
-- new one). url is exact; title mirrors deriveClaimSourceKey's folding for the common
-- cases (lowercase + whitespace collapse) — a title whose runtime normalization differs
-- simply stays a "new source" on next ingest, the pre-3.2 status quo. content_hash stays
-- NULL on backfilled rows, so the unchanged-source skip can never fire on stale data.
UPDATE knowledge_graph_sources
SET source_key = CASE
  WHEN url IS NOT NULL AND btrim(url) <> '' THEN 'url:' || btrim(url)
  WHEN title IS NOT NULL AND btrim(title) <> '' THEN 'title:' || lower(regexp_replace(btrim(title), '\s+', ' ', 'g'))
  ELSE NULL
END
WHERE source_key IS NULL;
