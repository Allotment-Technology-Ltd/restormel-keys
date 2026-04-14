import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProjectInWorkspace, getRouteWithSteps } from "$lib/server/db";
import { buildRouteGraphBundle } from "$lib/server/route-graph-bundle";

async function projectIdAndUid(
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

/** GET portable route+steps bundle (GitOps / agent diffs). No secrets. */
export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectIdAndUid(locals, params.id);
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    const withSteps = await getRouteWithSteps(params.routeId, scope.projectId, scope.userId);
    if (!withSteps) return json({ error: "Not found" }, { status: 404 });

    const bundle = buildRouteGraphBundle(scope.projectId, withSteps.route, withSteps.steps);
    return json({ data: bundle });
  } catch (e) {
    console.error("[route.export.get] internal error:", e);
    return json({ error: "internal_error", detail: "route_export_failed" }, { status: 500 });
  }
};
