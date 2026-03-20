import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { listRequestLogs } from "$lib/server/db";

const DEFAULT_LIMIT = 100;
const DEFAULT_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ url, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) {
    return { logs: [], filter: null, error: "Unauthorized" as string | null };
  }
  const until = Date.now();
  const since = until - DEFAULT_DAYS_MS;
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const projectId = url.searchParams.get("projectId")?.trim() || undefined;
  const routeId = url.searchParams.get("routeId")?.trim() || undefined;
  const status = url.searchParams.get("status")?.trim() || undefined;
  try {
    const rawLogs = await listRequestLogs(ctx.workspaceId, {
      limit,
      since,
      until,
      projectId,
      routeId,
    });
    const logs = status ? rawLogs.filter((l) => l.requestStatus === status) : rawLogs;
    const availableProjects = [...new Set(rawLogs.map((l) => l.projectId))];
    const availableRoutes = [...new Set(rawLogs.map((l) => l.routeId).filter((r): r is string => Boolean(r)))];
    const availableStatuses = [...new Set(rawLogs.map((l) => l.requestStatus))];
    return {
      logs,
      filter:
        projectId != null || routeId != null || status != null
          ? { projectId: projectId ?? null, routeId: routeId ?? null, status: status ?? null }
          : null,
      controls: {
        availableProjects,
        availableRoutes,
        availableStatuses,
        limit,
      },
      error: null,
    };
  } catch (e) {
    console.error("[logs] load failed:", e);
    return {
      logs: [],
      filter: null,
      controls: { availableProjects: [], availableRoutes: [], availableStatuses: [], limit },
      error: "Unable to load request logs",
    };
  }
};
