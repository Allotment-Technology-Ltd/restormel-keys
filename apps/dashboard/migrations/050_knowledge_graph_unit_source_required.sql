-- Every ingested graph idea must reference a knowledge_graph_sources row.
-- Backfill legacy Postgres units that were stored without source_id.

WITH orphan_workspaces AS (
  SELECT DISTINCT workspace_id
  FROM knowledge_graph_units
  WHERE source_id IS NULL
),
new_sources AS (
  INSERT INTO knowledge_graph_sources (id, workspace_id, title, source_kind, created_at)
  SELECT
    gen_random_uuid()::text,
    workspace_id,
    'Legacy ideas (source not recorded at ingest)',
    'legacy',
    (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
  FROM orphan_workspaces
  RETURNING id, workspace_id
)
UPDATE knowledge_graph_units u
SET source_id = ns.id
FROM new_sources ns
WHERE u.workspace_id = ns.workspace_id
  AND u.source_id IS NULL;

ALTER TABLE knowledge_graph_units
  ALTER COLUMN source_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'knowledge_graph_units_source_id_fkey'
  ) THEN
    ALTER TABLE knowledge_graph_units
      ADD CONSTRAINT knowledge_graph_units_source_id_fkey
      FOREIGN KEY (source_id) REFERENCES knowledge_graph_sources(id);
  END IF;
END $$;
