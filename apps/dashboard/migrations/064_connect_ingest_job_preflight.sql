-- Stage K3 (Connect run preflight, closing K-P0-2): record the launch preflight on the run.
--
-- Before a run is inserted, the BFF computes the provider-binding/credential preflight
-- (the exact lookup runtime-invoke performs mid-run). The result is stored on the job so
-- the run console and post-mortems can show what the launch gate saw at submit time:
--   { status: 'pass'|'blocked'|'legacy_env', projectId, environmentId,
--     providers: [{provider, stages, hasBinding, credentialExecutable, issue, ...}],
--     issues: [...], checkedAt }
ALTER TABLE knowledge_ingest_jobs ADD COLUMN IF NOT EXISTS preflight JSONB;
