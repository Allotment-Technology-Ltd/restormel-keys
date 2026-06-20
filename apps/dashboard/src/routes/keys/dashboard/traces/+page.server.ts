/**
 * Traces — "what my app actually asked" (Phase 3 Stage 5).
 *
 * Lists the workspace's verified-query traces as the SAME entity the Answer Console produced:
 * the question, the trust verdict (grounded / uncertain / abstained — the console's vocabulary),
 * the cited sources, the real answer-stage model, and timing. Filterable by project and verdict;
 * abstentions are surfaced distinctly (a designed state, not a failure).
 *
 * Authorization: workspace-scoped via the session actor's own workspace — a user sees only their
 * own workspace's traces. No secrets or cross-tenant data reach this surface.
 */
import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { listProvenanceTraces, type TraceListItem } from "$lib/server/connect-traces";
import { listProjectsByWorkspace } from "$lib/server/neon";

const VALID_VERDICTS = new Set(["grounded", "uncertain", "abstained"]);
const TRACE_LIST_LIMIT = 100;

export type TraceProjectOption = { id: string; name: string };

export const load: PageServerLoad = async ({ url, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) {
    return {
      traces: [] as TraceListItem[],
      projectOptions: [] as TraceProjectOption[],
      filter: { projectId: null as string | null, verdict: null as string | null },
      workspaceId: null as string | null,
      error: "Unauthorized" as string | null,
    };
  }

  // Sanitise the URL filters to a known vocabulary before they touch the query.
  const rawVerdict = url.searchParams.get("verdict");
  const verdict =
    rawVerdict && VALID_VERDICTS.has(rawVerdict)
      ? (rawVerdict as "grounded" | "uncertain" | "abstained")
      : null;
  const projectId = url.searchParams.get("projectId")?.trim() || null;

  try {
    const [traces, projects] = await Promise.all([
      listProvenanceTraces(ctx.workspaceId, {
        projectId: projectId ?? undefined,
        verdict: verdict ?? undefined,
        limit: TRACE_LIST_LIMIT,
      }),
      listProjectsByWorkspace(ctx.workspaceId),
    ]);

    return {
      traces,
      projectOptions: projects.map((p) => ({ id: p.id, name: p.name })),
      filter: { projectId, verdict },
      // The actor's OWN workspace id — needed to build the existing trace-export links. The
      // export endpoint re-authorizes it server-side (cross-tenant → 404), so this is not a
      // privilege grant, just the scope the export call already requires.
      workspaceId: ctx.workspaceId,
      error: null as string | null,
    };
  } catch (e) {
    // Log only the message (no query text / no values) — data-minimal per the security baseline.
    console.warn("[traces] load failed:", e instanceof Error ? e.message : "unknown error");
    return {
      traces: [] as TraceListItem[],
      projectOptions: [] as TraceProjectOption[],
      filter: { projectId, verdict },
      workspaceId: ctx.workspaceId,
      error: "Could not load traces. The verification store may be initialising." as string | null,
    };
  }
};
