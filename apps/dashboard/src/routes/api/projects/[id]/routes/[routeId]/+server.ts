import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProjectInWorkspace, getRoute, updateRoute, deleteRoute } from "$lib/server/db";

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

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await projectIdAndUid(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const route = await getRoute(params.routeId, scope.projectId, scope.userId);
  if (!route) return json({ error: "Not found" }, { status: 404 });
  return json({ data: route });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await projectIdAndUid(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  let body: { name?: string; description?: string | null; defaultModelId?: string | null; billingMode?: string | null; routeMode?: string | null; status?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const updates: Parameters<typeof updateRoute>[3] = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description;
  if (body.defaultModelId !== undefined) updates.defaultModelId = body.defaultModelId;
  if (body.billingMode !== undefined) updates.billingMode = body.billingMode;
  if (body.routeMode !== undefined) updates.routeMode = body.routeMode;
  if (typeof body.status === "string") updates.status = body.status.trim();
  const route = await updateRoute(params.routeId, scope.projectId, scope.userId, updates);
  if (!route) return json({ error: "Not found" }, { status: 404 });
  return json({ data: route });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await projectIdAndUid(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const ok = await deleteRoute(params.routeId, scope.projectId, scope.userId);
  if (!ok) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};
