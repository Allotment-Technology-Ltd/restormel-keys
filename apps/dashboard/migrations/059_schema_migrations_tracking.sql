-- Stage 1.7 (deploy-time migrations): migration tracking table.
--
-- schema_migrations records every applied migration file by filename.
-- The idempotent runner (scripts/apply-migrations.mjs) inserts a row after
-- each file completes; the runtime high-water-mark assertion reads the max
-- filename from this table to verify the schema is up to date before serving.
--
-- Rollback: DROP TABLE IF EXISTS schema_migrations;
--           (loses tracking history; safe because the runner re-applies missing rows)
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: record all migrations already applied before this table existed.
-- The runner also does this idempotently, but running it here ensures the table
-- is pre-populated when the migration is first applied via psql in CI.
INSERT INTO schema_migrations (filename, applied_at)
SELECT unnest(ARRAY[
  '001_initial.sql',
  '002_better_auth.sql',
  '003_workspaces_and_environments.sql',
  '004_control_plane_tables.sql',
  '005_seed_model_catalog.sql',
  '006_route_steps_timestamps.sql',
  '007_workspace_plan_and_billing_refs.sql',
  '008_workspace_plan_expires_at.sql',
  '009_workspace_plan_ended_at.sql',
  '010_user_subscription_overview_view.sql',
  '011_seed_full_model_catalog.sql',
  '012_ingestion_routing_control_plane.sql',
  '013_route_version_history.sql',
  '014_provenance_and_policy_versions.sql',
  '015_route_coverage_indexes.sql',
  '016_provenance_backfill_defaults.sql',
  '017_catalog_provider_id.sql',
  '018_catalog_allowlist_cleanup.sql',
  '019_catalog_model_observations.sql',
  '020_project_model_bindings.sql',
  '021_project_model_bindings_kind.sql',
  '022_cli_device_sessions.sql',
  '023_service_admins.sql',
  '024_provider_credential_encryption.sql',
  '025_project_model_bindings_logical_ref.sql',
  '026_projects_testing_flag.sql',
  '027_restormel_testing_run_jobs.sql',
  '028_users_app_mirror.sql',
  '029_workspace_webhooks.sql',
  '030_founders_applications.sql',
  '031_phase_f_route_steps_pool_parallel.sql',
  '032_route_graph_option_b.sql',
  '033_hosted_runtime_jobs.sql',
  '034_hosted_runtime_jobs_queue.sql',
  '035_knowledge_ingest_jobs.sql',
  '036_knowledge_graph_targets.sql',
  '037_knowledge_pipeline_profiles.sql',
  '038_knowledge_graph_postgres_spine.sql',
  '039_knowledge_source_documents.sql',
  '040_knowledge_graph_stages.sql',
  '041_knowledge_stage_models.sql',
  '042_founders_access_and_admin_emails.sql',
  '043_project_default_environment.sql',
  '044_knowledge_ingest_job_telemetry.sql',
  '045_knowledge_source_document_provenance.sql',
  '046_knowledge_domain_pack_quality.sql',
  '047_ingest_quality_uplift.sql',
  '048_workspace_settings.sql',
  '049_knowledge_ingest_quality_runs.sql',
  '050_knowledge_graph_unit_source_required.sql',
  '051_workspace_graph_store_config.sql',
  '052_connect_webhooks.sql',
  '053_ingest_idempotency_keys.sql',
  '054_connect_provenance_traces.sql',
  '055_connect_claim_versions.sql',
  '056_connect_claim_judgments.sql',
  '057_connect_eval_verdicts.sql',
  '058_connect_graph_hot_path_indexes.sql',
  '059_schema_migrations_tracking.sql'
]), NOW()
ON CONFLICT (filename) DO NOTHING;
