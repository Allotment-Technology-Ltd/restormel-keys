import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProjectInWorkspace } from "$lib/server/db";
import { validateRouteBinding } from "$lib/server/route-resolver";

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

/** POST: preflight route binding (env + workload/stage vs route metadata). */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user) {
      return json({ error: "unauthorized", message: "Unauthorized" }, { status: 401 });
    }
    const scope = await projectIdAndUid(locals, params.id);
    if (!scope) {
      return json(
        { error: "unauthorized", message: "Unauthorized or project not found" },
        { status: 401 }
      );
    }

    let body: {
      environmentId?: string;
      workload?: string | null;
      stage?: string | null;
      task?: string | null;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    const environmentId = typeof body.environmentId === "string" ? body.environmentId.trim() : "";
    if (!environmentId) {
      return json({ error: "environmentId is required" }, { status: 400 });
    }

    const result = await validateRouteBinding(scope.projectId, scope.userId, params.routeId, {
      environmentId,
      workload: body.workload,
      stage: body.stage,
      task: body.task,
    });
    return json({ data: { ok: result.ok, reasons: result.reasons } });
  } catch (e) {
    console.error("[validate-binding] internal error:", e);
    return json({ error: "internal_error", detail: "validate_binding_failed" }, { status: 500 });
  }
};
