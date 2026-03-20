-- Query support indexes for route coverage and readiness advisory APIs.

CREATE INDEX IF NOT EXISTS idx_routes_project_env_stage_workload
  ON routes(project_id, environment_id, stage, workload);

CREATE INDEX IF NOT EXISTS idx_route_steps_route_enabled_order
  ON route_steps(route_id, enabled, order_index);

CREATE INDEX IF NOT EXISTS idx_provider_bindings_project_integration
  ON provider_bindings(project_id, provider_integration_id);
