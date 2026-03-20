import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getProjectInWorkspace,
  getRouteWithSteps,
  getRouteVersionEventByVersion,
  listRouteVersionEvents,
  replaceRouteStepsFromSnapshot,
  updateRoute,
  insertRouteVersionEvent,
} from "$lib/server/db";

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

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectScope(locals, params.id);
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    let body: { toVersion?: number };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    const routeWithSteps = await getRouteWithSteps(params.routeId, scope.projectId, scope.userId);
    if (!routeWithSteps) return json({ error: "route_not_found" }, { status: 404 });

    const currentPublished = routeWithSteps.route.publishedVersion ?? 1;
    let targetVersion =
      typeof body.toVersion === "number" && Number.isInteger(body.toVersion) && body.toVersion > 0
        ? body.toVersion
        : undefined;

    if (!targetVersion) {
      const history = await listRouteVersionEvents(params.routeId, scope.projectId, scope.userId, 20);
      const previous = history.find((h) => h.version < currentPublished);
      targetVersion = previous?.version;
    }
    if (!targetVersion) return json({ error: "rollback_target_not_found" }, { status: 404 });

    const snapshot = await getRouteVersionEventByVersion(
      params.routeId,
      scope.projectId,
      scope.userId,
      targetVersion
    );
    if (!snapshot) return json({ error: "rollback_target_not_found" }, { status: 404 });
    if (!snapshot.stepsSnapshot || !Array.isArray(snapshot.stepsSnapshot)) {
      return json({ error: "rollback_snapshot_missing" }, { status: 409 });
    }

    const restoredSteps = await replaceRouteStepsFromSnapshot({
      routeId: params.routeId,
      projectId: scope.projectId,
      userId: scope.userId,
      stepsSnapshot: snapshot.stepsSnapshot,
    });
    if (!restoredSteps) return json({ error: "route_not_found" }, { status: 404 });

    const rolled = await updateRoute(params.routeId, scope.projectId, scope.userId, {
      version: targetVersion,
      publishedVersion: targetVersion,
      updatedVia: locals.user.authType ?? "session",
      updatedBy: locals.user.uid,
      changeSummary: `Rolled back route to version ${targetVersion}`,
    });
    if (!rolled) return json({ error: "route_not_found" }, { status: 404 });

    await insertRouteVersionEvent({
      routeId: params.routeId,
      projectId: scope.projectId,
      version: targetVersion,
      action: "rollback",
      actorId: locals.user.uid,
      actorType: locals.user.authType ?? "session",
      summary: `Rolled back route to version ${targetVersion}`,
      routeSnapshot: rolled as unknown as Record<string, unknown>,
      stepsSnapshot: restoredSteps as unknown as Record<string, unknown>[],
      metadata: { fromPublishedVersion: currentPublished },
    });

    return json({
      data: {
        route: rolled,
        restoredSteps,
        rolledBackToVersion: targetVersion,
      },
    });
  } catch (e) {
    console.error("[route.rollback] internal error:", e);
    return json({ error: "internal_error", detail: "route_rollback_failed" }, { status: 500 });
  }
};

