-- Backfill provenance defaults for existing routes/policies.

UPDATE routes
SET
  updated_via = COALESCE(updated_via, 'system'),
  updated_by = COALESCE(updated_by, created_by, 'system'),
  change_summary = COALESCE(change_summary, 'Backfilled provenance defaults'),
  content_hash = COALESCE(content_hash, md5(COALESCE(id, '') || ':' || COALESCE(updated_at::text, '0')))
WHERE updated_via IS NULL
   OR updated_by IS NULL
   OR change_summary IS NULL
   OR content_hash IS NULL;

UPDATE policies
SET
  updated_via = COALESCE(updated_via, 'system'),
  updated_by = COALESCE(updated_by, created_by, 'system'),
  change_summary = COALESCE(change_summary, 'Backfilled provenance defaults'),
  content_hash = COALESCE(content_hash, md5(COALESCE(id, '') || ':' || COALESCE(updated_at::text, '0')))
WHERE updated_via IS NULL
   OR updated_by IS NULL
   OR change_summary IS NULL
   OR content_hash IS NULL;
