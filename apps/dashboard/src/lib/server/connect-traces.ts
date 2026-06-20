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
import {
  deriveTraceVerdict,
  citedSourceTitles,
  type TraceVerdictSummary,
} from "$lib/connect/trace-verdict";

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

/**
 * A verified-query trace summarised for the Traces list (Phase 3 Stage 5) — the SAME query
 * entity the Answer Console produced, reduced to the display-ready fields. Derived server-side
 * from the persisted {@link ProvenanceTrace}; carries no secrets and the same trust vocabulary
 * the console uses (verdict via {@link deriveTraceVerdict}).
 */
export type TraceListItem = {
  traceId: string;
  projectId: string | null;
  /** The user's question. Shown back to them in their own workspace (already their data). */
  query: string;
  queriedAt: string;
  domainPack: string;
  graphStoreType: string;
  /** Same vocabulary as the console: grounded | uncertain | abstained. */
  verdict: TraceVerdictSummary;
  /** Distinct cited source titles (the source cards), capped for the list row. */
  citedSources: string[];
  citedSourceCount: number;
  /** Real answer-stage model when the trace recorded it; null on older/unknown traces. */
  answerModel: { provider: string; model: string } | null;
  /** Wall-clock retrieval time when measured (0 in v1.0 traces — not yet instrumented). */
  totalMs: number;
  claimsRetrieved: number;
  claimsFiltered: number;
};

export type ListProvenanceTracesFilters = {
  projectId?: string;
  /** Filter to one verdict (e.g. only abstentions). */
  verdict?: "grounded" | "uncertain" | "abstained";
  limit?: number;
};

const TRACE_LIST_SOURCE_CAP = 6;

/**
 * Lists a workspace's non-expired verified-query traces, newest first, summarised for the
 * Traces view. Workspace-scoped and fully parameterized; the verdict filter is applied after
 * derivation (the verdict is computed from the claim set, not a stored column).
 *
 * Authorization is the caller's responsibility — pass a workspaceId the actor owns.
 */
export async function listProvenanceTraces(
  workspaceId: string,
  filters: ListProvenanceTracesFilters = {},
): Promise<TraceListItem[]> {
  const sql = getSql();
  // Cap the scan; derive-then-filter on verdict means we over-fetch a little when a verdict
  // filter is set, then trim to `limit` after derivation.
  const scanLimit = Math.min(Math.max(1, filters.limit ?? 100), 500);
  const projectId = filters.projectId;

  const rows = await sql`
    SELECT trace_id, project_id, query, domain_pack, graph_store_type, trace, queried_at
    FROM connect_provenance_traces
    WHERE workspace_id = ${workspaceId}
      AND expires_at > NOW()
      ${projectId != null ? sql`AND project_id = ${projectId}` : sql``}
    ORDER BY queried_at DESC
    LIMIT ${scanLimit}
  `;

  const items: TraceListItem[] = [];
  for (const r of rows as Array<{
    trace_id: string;
    project_id: string | null;
    query: string;
    domain_pack: string;
    graph_store_type: string;
    trace: ProvenanceTrace;
    queried_at: string | Date;
  }>) {
    const trace = r.trace;
    const claims = Array.isArray(trace.claims) ? trace.claims : [];
    const verdict = deriveTraceVerdict(claims);
    if (filters.verdict && verdict.verdict !== filters.verdict) continue;

    const sources = citedSourceTitles(claims);
    const answer = trace.answer_model;
    items.push({
      traceId: r.trace_id,
      projectId: r.project_id,
      query: trace.query ?? r.query,
      queriedAt:
        typeof r.queried_at === "string" ? r.queried_at : new Date(r.queried_at).toISOString(),
      domainPack: r.domain_pack,
      graphStoreType: r.graph_store_type,
      verdict,
      citedSources: sources.slice(0, TRACE_LIST_SOURCE_CAP),
      citedSourceCount: sources.length,
      answerModel:
        answer && typeof answer.provider === "string" && typeof answer.model === "string"
          ? { provider: answer.provider, model: answer.model }
          : null,
      totalMs: typeof trace.timing?.total_ms === "number" ? trace.timing.total_ms : 0,
      claimsRetrieved:
        typeof trace.result?.claims_retrieved === "number" ? trace.result.claims_retrieved : 0,
      claimsFiltered:
        typeof trace.result?.claims_filtered === "number" ? trace.result.claims_filtered : 0,
    });
  }

  return items.slice(0, Math.min(Math.max(1, filters.limit ?? 100), 500));
}
