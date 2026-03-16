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
  try {
    const logs = await listRequestLogs(ctx.workspaceId, {
      limit,
      since,
      until,
      projectId,
      routeId,
    });
    return {
      logs,
      filter: projectId != null || routeId != null ? { projectId: projectId ?? null, routeId: routeId ?? null } : null,
      error: null,
    };
  } catch (e) {
    console.error("[logs] load failed:", e);
    return { logs: [], filter: null, error: "Unable to load request logs" };
  }
};
