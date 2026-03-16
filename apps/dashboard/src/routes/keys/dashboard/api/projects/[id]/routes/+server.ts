import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProjectInWorkspace, listRoutes, createRoute } from "$lib/server/db";

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

/** GET: list routes for project. Query: environmentId (optional). */
export const GET: RequestHandler = async ({ params, url, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await projectIdAndUid(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const environmentId = url.searchParams.get("environmentId")?.trim() || undefined;
  const data = await listRoutes(scope.projectId, scope.userId, { environmentId });
  return json({ data });
};

/** POST: create route. Body: environmentId, name, description?, defaultModelId?, billingMode?, routeMode?. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await projectIdAndUid(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  let body: {
    environmentId?: string;
    name?: string;
    description?: string;
    defaultModelId?: string | null;
    billingMode?: string | null;
    routeMode?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const environmentId = typeof body.environmentId === "string" ? body.environmentId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!environmentId || !name) return json({ error: "environmentId and name are required" }, { status: 400 });
  const route = await createRoute({
    projectId: scope.projectId,
    environmentId,
    name,
    description: typeof body.description === "string" ? body.description.trim() : undefined,
    defaultModelId: body.defaultModelId ?? undefined,
    billingMode: body.billingMode ?? undefined,
    routeMode: body.routeMode ?? undefined,
    userId: scope.userId,
  });
  if (!route) return json({ error: "Not found or environment not in project" }, { status: 404 });
  return json({ data: route }, { status: 201 });
};
