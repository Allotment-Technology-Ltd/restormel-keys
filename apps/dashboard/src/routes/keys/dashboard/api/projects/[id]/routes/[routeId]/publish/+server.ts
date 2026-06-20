import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProjectInWorkspace } from "$lib/server/db";
import { publishRouteInScope } from "$lib/server/route-publish";

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

export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectScope(locals, params.id);
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    const result = await publishRouteInScope({
      routeId: params.routeId,
      projectId: scope.projectId,
      userId: scope.userId,
      actorId: locals.user.uid,
      actorType: locals.user.authType ?? "session",
    });

    if (!result.ok) {
      if (result.code === "route_not_found") return json({ error: "route_not_found" }, { status: 404 });
      return json(
        {
          error: "publish_validation_failed",
          message: "Route steps are not ready to publish (missing executable provider/model).",
          errors: result.errors,
        },
        { status: 400 }
      );
    }

    return json({ data: { route: result.route, publishedVersion: result.publishedVersion } });
  } catch (e) {
    console.error("[route.publish] internal error:", e);
    return json({ error: "internal_error", detail: "route_publish_failed" }, { status: 500 });
  }
};

