import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProjectInWorkspace, listRouteSteps, createRouteStep } from "$lib/server/db";

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

/** GET: list steps for route (ordered by orderIndex). */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await projectIdAndUid(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const steps = await listRouteSteps(params.routeId, scope.projectId, scope.userId);
  return json({ data: steps });
};

/** POST: create step. Body: orderIndex, providerPreference?, modelId?, conditionBlock?, fallbackOn?, timeoutMs?, enabled?. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
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
  const orderIndex = typeof body.orderIndex === "number" ? body.orderIndex : 0;
  const step = await createRouteStep({
    routeId: params.routeId,
    projectId: scope.projectId,
    userId: scope.userId,
    orderIndex,
    providerPreference: body.providerPreference ?? undefined,
    modelId: body.modelId ?? undefined,
    conditionBlock: body.conditionBlock ?? undefined,
    fallbackOn: body.fallbackOn ?? undefined,
    timeoutMs: body.timeoutMs ?? undefined,
    enabled: body.enabled,
  });
  if (!step) return json({ error: "Not found" }, { status: 404 });
  return json({ data: step }, { status: 201 });
};
