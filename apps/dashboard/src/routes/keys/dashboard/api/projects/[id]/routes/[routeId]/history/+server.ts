import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProjectInWorkspace, getRoute, listRouteVersionEvents } from "$lib/server/db";

async function projectScope(
  locals: App.Locals,
  projectId: string
): Promise<{ projectId: string; userId: string } | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key") {
    if (locals.user.projectIdForKey !== projectId) return null;
    return { projectId, userId: locals.user.uid };
  }
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    const project = await getProjectInWorkspace(projectId, locals.user.workspaceId);
    return project ? { projectId, userId: project.userId } : null;
  }
  return { projectId, userId: locals.user.uid };
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectScope(locals, params.id);
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    const route = await getRoute(params.routeId, scope.projectId, scope.userId);
    if (!route) return json({ error: "route_not_found" }, { status: 404 });

    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 50;
    const events = await listRouteVersionEvents(params.routeId, scope.projectId, scope.userId, limit);
    return json({ data: events });
  } catch (e) {
    console.error("[route.history] internal error:", e);
    return json({ error: "internal_error", detail: "route_history_failed" }, { status: 500 });
  }
};

