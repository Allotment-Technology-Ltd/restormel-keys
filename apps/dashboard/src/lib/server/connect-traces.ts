/**
 * Provenance trace persistence (Stage 4B).
 *
 * Stores the versioned {@link ProvenanceTrace} produced on every Connect v1 retrieval and
 * reads it back for the GET /connect/v1/traces/{traceId} endpoints. 90-day retention is
 * enforced by the table's `expires_at` default and filtered on read. Migration:
 * apps/dashboard/migrations/054_connect_provenance_traces.sql.
 */
import type { ProvenanceTrace } from "@restormel/contracts/provenance-trace";
import { getSql } from "$lib/server/neon";

export type ProvenanceTraceRecord = {
  traceId: string;
  workspaceId: string;
  projectId: string | null;
  trace: ProvenanceTrace;
};

/**
 * Persists a provenance trace. Best-effort: storage failures must never break a retrieval
 * response, so callers should catch and continue (the trace_id is still returned).
 */
export async function insertProvenanceTrace(params: {
  trace: ProvenanceTrace;
  projectId?: string | null;
}): Promise<void> {
  const sql = getSql();
  const t = params.trace;
  await sql`
    INSERT INTO connect_provenance_traces
      (trace_id, workspace_id, project_id, query, domain_pack, graph_store_type,
       schema_version, trace, queried_at)
    VALUES (
      ${t.trace_id},
      ${t.workspace_id},
      ${params.projectId ?? null},
      ${t.query},
      ${t.domain_pack},
      ${t.graph_store_type},
      ${t.schema_version},
      ${JSON.stringify(t)},
      ${t.queried_at}
    )
    ON CONFLICT (trace_id) DO NOTHING
  `;
}

/**
 * Fetches a non-expired provenance trace by id. Returns null when missing or past its
 * 90-day retention window. The caller is responsible for workspace authorization.
 */
export async function getProvenanceTraceById(
  traceId: string,
): Promise<ProvenanceTraceRecord | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT trace_id, workspace_id, project_id, trace
    FROM connect_provenance_traces
    WHERE trace_id = ${traceId}
      AND expires_at > NOW()
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as {
    trace_id: string;
    workspace_id: string;
    project_id: string | null;
    trace: ProvenanceTrace;
  };
  return {
    traceId: row.trace_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    trace: row.trace,
  };
}
