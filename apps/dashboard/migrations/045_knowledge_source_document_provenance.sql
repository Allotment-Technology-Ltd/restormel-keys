-- Source document provenance (pre-check metadata: title, authors, canonical URL, etc.)
-- ROLLBACK: ALTER TABLE knowledge_source_documents DROP COLUMN IF EXISTS provenance;

ALTER TABLE knowledge_source_documents
  ADD COLUMN IF NOT EXISTS provenance JSONB;
