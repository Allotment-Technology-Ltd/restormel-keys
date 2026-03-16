import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProjectInWorkspace, updateRouteStep, deleteRouteStep } from "$lib/server/db";

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

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await projectIdAndUid(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  let body: {
    orderIndex?: number;
    providerPreference?: string | null;
    modelId?: string | null;
    conditionBlock?: Record<string, unknown> | null;
    fallbackOn?: string | null;
    timeoutMs?: number | null;
    enabled?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const step = await updateRouteStep(
    params.stepId,
    params.routeId,
    scope.projectId,
    scope.userId,
    body
  );
  if (!step) return json({ error: "Not found" }, { status: 404 });
  return json({ data: step });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await projectIdAndUid(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const ok = await deleteRouteStep(params.stepId, params.routeId, scope.projectId, scope.userId);
  if (!ok) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};
