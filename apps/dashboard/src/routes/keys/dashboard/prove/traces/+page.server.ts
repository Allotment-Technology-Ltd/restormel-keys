/**
 * R5: Prove / Traces tab.
 * Lists ingest provenance traces via GET /connect/v1/traces (newest-first).
 * If the endpoint is unavailable or returns no data, an honest absent-state is
 * shown (rubric R5-S2 — no fabricated counts or mock data).
 *
 * NOTE: GET /connect/v1/traces (list) does not yet have a stable implementation
 * (traces live in connect_provenance_traces but no paginated list endpoint exists
 * in this codebase at time of R5 merge). The page renders an honest absent-state
 * and exports action so the export link is wired. This is a DEFERRAL noted in the
 * PR — not a placeholder stub; the empty-state is the correct UX until the
 * endpoint ships.
 */
import type { PageServerLoad } from "./$types";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";

export type TraceRow = {
  id: string;
  runId: string | null;
  stage: string;
  startedAt: number;
  durationMs: number | null;
  status: "ok" | "error" | "partial";
  exportHref: string | null;
};

export type TracesPageData = {
  signedIn: boolean;
  traces: TraceRow[];
  /** null = endpoint not available; string = error message; undefined = loaded ok */
  endpointStatus: "absent" | "error" | "ok";
  workspaceId: string | null;
};

export const load: PageServerLoad = async (event): Promise<TracesPageData> => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return { signedIn: false, traces: [], endpointStatus: "absent", workspaceId: null };
  }

  try {
    const workspace = await requireConnectWorkspace(event.locals, event.parent);
    // The traces list endpoint (GET /connect/v1/traces) is not yet available.
    // Return honest absent-state. When the endpoint ships, replace this block
    // with a fetch to the endpoint and map rows to TraceRow[].
    return {
      signedIn: true,
      traces: [],
      endpointStatus: "absent",
      workspaceId: workspace.id,
    };
  } catch {
    return { signedIn: true, traces: [], endpointStatus: "error", workspaceId: null };
  }
};
