import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { listRequestLogs, listProjectsByWorkspace, listRoutes } from "$lib/server/db";
import {
  parseLogFilters,
  timePresetToWindow,
  applyClientFilters,
  buildNameMap,
  namedOptionsForIds,
  hasActiveFilters,
  type LogRow,
  type LogMetadata,
} from "$lib/logs-filters";

/** Trim the raw metadata JSONB into the display-safe shape the receipt renders. */
function trimMetadata(raw: Record<string, unknown> | null): LogMetadata | null {
  if (!raw) return null;
  const out: LogMetadata = {};
  if (typeof raw.explanation === "string") out.explanation = raw.explanation;
  if (typeof raw.stage === "string") out.stage = raw.stage;
  if (typeof raw.ingest_job_id === "string") out.ingestJobId = raw.ingest_job_id;
  if (typeof raw.limit === "number") out.limit = raw.limit;
  if (typeof raw.used === "number") out.used = raw.used;
  if (Array.isArray(raw.violations)) {
    out.violations = raw.violations
      .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
      .map((v) => ({
        policyName: typeof v.policyName === "string" ? v.policyName : undefined,
        type: typeof v.type === "string" ? v.type : undefined,
        message: typeof v.message === "string" ? v.message : undefined,
      }));
  }
  return Object.keys(out).length > 0 ? out : null;
}

export const load: PageServerLoad = async ({ url, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) {
    return {
      logs: [] as LogRow[],
      filter: null,
      controls: {
        projectOptions: [],
        routeOptions: [],
        availableStatuses: [],
        time: "7d" as const,
        limit: 100,
        source: null,
        status: null,
        q: null,
      },
      counts: { matched: 0, windowTotal: 0 },
      hasFilters: false,
      error: "Unauthorized" as string | null,
    };
  }

  const state = parseLogFilters((k) => url.searchParams.get(k));
  const now = Date.now();
  const { since, until, preset } = timePresetToWindow(state.time, now);

  try {
    const rawLogs = await listRequestLogs(ctx.workspaceId, {
      limit: state.limit,
      since,
      until,
      projectId: state.projectId ?? undefined,
      routeId: state.routeId ?? undefined,
    });

    // Map to the UI LogRow shape (trimmed metadata for the receipt).
    const windowLogs: LogRow[] = rawLogs.map((l) => ({
      id: l.id,
      projectId: l.projectId,
      environmentId: l.environmentId,
      routeId: l.routeId,
      gatewayKeyId: l.gatewayKeyId,
      providerType: l.providerType,
      finalModelId: l.finalModelId,
      requestStatus: l.requestStatus,
      latencyMs: l.latencyMs,
      ttftMs: l.ttftMs,
      inputTokens: l.inputTokens,
      outputTokens: l.outputTokens,
      estimatedCost: l.estimatedCost,
      fallbackCount: l.fallbackCount,
      errorCode: l.errorCode,
      createdAt: l.createdAt,
      source: l.source,
      metadata: trimMetadata(l.metadata),
    }));

    // status + source + free-text are matched in $lib (stated in PR): status mirrors the
    // prior post-query filter; source derives "agent"/"dashboard" from gatewayKeyId; q has
    // no DB index so it scans the returned fields.
    const logs = applyClientFilters(windowLogs, state);

    // Name resolution: build {id → name} maps so the dropdowns show names, not UUIDs.
    // Projects are workspace-scoped; routes are resolved per project that appears in the
    // window (listRoutes needs the project's owner userId — Project carries it).
    const projects = await listProjectsByWorkspace(ctx.workspaceId);
    const projectNameMap = buildNameMap(projects.map((p) => ({ id: p.id, name: p.name })));

    const appearingProjectIds = [...new Set(windowLogs.map((l) => l.projectId))];
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    const routeRecords = (
      await Promise.all(
        appearingProjectIds.map(async (pid) => {
          const proj = projectsById.get(pid);
          if (!proj) return [];
          try {
            return await listRoutes(pid, proj.userId);
          } catch {
            return [];
          }
        }),
      )
    ).flat();
    const routeNameMap = buildNameMap(routeRecords.map((r) => ({ id: r.id, name: r.name })));

    const projectOptions = namedOptionsForIds(appearingProjectIds, projectNameMap);
    const routeOptions = namedOptionsForIds(
      [...new Set(windowLogs.map((l) => l.routeId).filter((r): r is string => Boolean(r)))],
      routeNameMap,
    );
    const availableStatuses = [...new Set(windowLogs.map((l) => l.requestStatus))].sort();

    return {
      logs,
      filter: hasActiveFilters(state)
        ? {
            projectId: state.projectId,
            routeId: state.routeId,
            status: state.status,
            source: state.source,
            time: preset,
            q: state.q,
            projectName: state.projectId ? projectNameMap[state.projectId] ?? null : null,
            routeName: state.routeId ? routeNameMap[state.routeId] ?? null : null,
          }
        : null,
      controls: {
        projectOptions,
        routeOptions,
        availableStatuses,
        time: preset,
        limit: state.limit,
        source: state.source,
        status: state.status,
        q: state.q,
      },
      counts: { matched: logs.length, windowTotal: windowLogs.length },
      hasFilters: hasActiveFilters(state),
      error: null,
    };
  } catch (e) {
    console.error("[logs] load failed:", e);
    return {
      logs: [] as LogRow[],
      filter: null,
      controls: {
        projectOptions: [],
        routeOptions: [],
        availableStatuses: [],
        time: preset,
        limit: state.limit,
        source: state.source,
        status: state.status,
        q: state.q,
      },
      counts: { matched: 0, windowTotal: 0 },
      hasFilters: hasActiveFilters(state),
      error: "Unable to load request logs",
    };
  }
};
