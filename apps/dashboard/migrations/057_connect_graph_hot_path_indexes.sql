-- Stage 1.5 (ingest reliability/perf review): indexes for hot Connect query paths.
--
-- 1) knowledge_graph_relations(from_unit_id / to_unit_id):
--    deleteUnitPostgres (remediation drop) deletes relations with
--    `WHERE workspace_id = $1 AND (from_unit_id = $2 OR to_unit_id = $2)`.
--    Only (workspace_id, created_at) was indexed, so every dropped unit scanned the
--    workspace's whole relation set — O(units_dropped × relations) per remediation pass.
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_relations_from_unit
  ON knowledge_graph_relations (from_unit_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_relations_to_unit
  ON knowledge_graph_relations (to_unit_id);

-- 2) knowledge_graph_units(workspace_id, validation_status):
--    graph stats (GROUP BY validation_status), triage counts (FILTER on
--    validation_status), and re-validation scope selection all predicate on
--    validation_status per workspace; these run on every hub/pulse/scorecard load
--    when the spine is the active store.
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_units_workspace_validation
  ON knowledge_graph_units (workspace_id, validation_status);

-- 3) knowledge_graph_units(source_id):
--    re-validation groups units by source; source-link audits join units → sources.
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_units_source
  ON knowledge_graph_units (source_id);
