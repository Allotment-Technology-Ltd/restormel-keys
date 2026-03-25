import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getProject,
  getProjectInWorkspace,
  getRouteWithSteps,
  updateRoute,
  insertRouteVersionEvent,
  insertAuditEvent,
} from "$lib/server/db";
import { validateRouteStepsForPublish } from "$lib/server/route-publish-validation";

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

    const routeWithSteps = await getRouteWithSteps(params.routeId, scope.projectId, scope.userId);
    if (!routeWithSteps) return json({ error: "route_not_found" }, { status: 404 });

    const publishErrors = validateRouteStepsForPublish(routeWithSteps.route, routeWithSteps.steps);
    if (publishErrors.length > 0) {
      return json(
        {
          error: "publish_validation_failed",
          message: "Route steps are not ready to publish (missing executable provider/model).",
          errors: publishErrors,
        },
        { status: 400 }
      );
    }

    const nextVersion = Math.max(routeWithSteps.route.version ?? 1, (routeWithSteps.route.publishedVersion ?? 1)) + 1;
    const published = await updateRoute(params.routeId, scope.projectId, scope.userId, {
      version: nextVersion,
      publishedVersion: nextVersion,
      updatedVia: locals.user.authType ?? "session",
      updatedBy: locals.user.uid,
      changeSummary: `Published route version ${nextVersion}`,
    });
    if (!published) return json({ error: "route_not_found" }, { status: 404 });

    await insertRouteVersionEvent({
      routeId: params.routeId,
      projectId: scope.projectId,
      version: nextVersion,
      action: "publish",
      actorId: locals.user.uid,
      actorType: locals.user.authType ?? "session",
      summary: `Published route version ${nextVersion}`,
      routeSnapshot: published as unknown as Record<string, unknown>,
      stepsSnapshot: routeWithSteps.steps as unknown as Record<string, unknown>[],
    });

    try {
      const project = await getProject(scope.projectId, scope.userId);
      if (project?.workspaceId) {
        await insertAuditEvent({
          workspaceId: project.workspaceId,
          actorId: locals.user.uid,
          actorType: locals.user.authType ?? "session",
          eventType: "route_published",
          targetType: "route",
          targetId: params.routeId,
          summary: `Route published (v${nextVersion})`,
        });
      }
    } catch {
      // Best effort; publishing should not fail if audit write fails.
    }

    return json({ data: { route: published, publishedVersion: nextVersion } });
  } catch (e) {
    console.error("[route.publish] internal error:", e);
    return json({ error: "internal_error", detail: "route_publish_failed" }, { status: 500 });
  }
};

