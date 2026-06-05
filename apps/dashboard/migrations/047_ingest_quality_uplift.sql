-- Ingest quality uplift: pack archetype, chunk provenance, review telemetry.

ALTER TABLE knowledge_domain_packs
  ADD COLUMN IF NOT EXISTS archetype TEXT;

ALTER TABLE knowledge_domain_packs
  ADD COLUMN IF NOT EXISTS prompt_template_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE knowledge_graph_units
  ADD COLUMN IF NOT EXISTS source_chunk_index INTEGER;

CREATE TABLE IF NOT EXISTS knowledge_review_signals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  unit_id TEXT,
  ai_status TEXT,
  ai_flag_reason TEXT,
  human_status TEXT NOT NULL,
  human_note TEXT,
  ai_flag_theme TEXT,
  human_note_theme TEXT,
  verdict_delta TEXT NOT NULL,
  action_type TEXT NOT NULL,
  domain_pack_id TEXT,
  pack_archetype TEXT,
  pack_slug TEXT,
  quality_preset TEXT,
  schema_mode TEXT,
  unit_type TEXT,
  source_kind TEXT,
  ingest_job_id TEXT,
  time_since_ingest_complete_ms BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_signals_archetype_delta
  ON knowledge_review_signals (pack_archetype, verdict_delta, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_signals_theme
  ON knowledge_review_signals (ai_flag_theme, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_signals_job
  ON knowledge_review_signals (ingest_job_id);

-- Backfill builtin pack prompts where empty (archetype defaults applied at runtime if still empty).
UPDATE knowledge_domain_packs
SET archetype = 'argumentative', prompt_template_version = 1
WHERE slug = 'philosophy' AND archetype IS NULL;

UPDATE knowledge_domain_packs
SET archetype = 'generic', prompt_template_version = 1
WHERE slug = 'generic' AND archetype IS NULL;
