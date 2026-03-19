import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProject, getProjectInWorkspace, listModels } from "$lib/server/db";

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
  const project = await getProject(projectId, locals.user.uid);
  return project ? { projectId, userId: locals.user.uid } : null;
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const scope = await projectScope(locals, params.id);
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  if (!scope) return json({ error: "Not found" }, { status: 404 });

  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const family = url.searchParams.get("family")?.trim() || undefined;
  const lifecycleState = url.searchParams.get("lifecycleState")?.trim() || undefined;

  const limit = limitParam != null ? Math.min(Math.max(1, parseInt(limitParam, 10) || 100), 500) : 100;
  const offset = offsetParam != null ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;

  const models = await listModels({ lifecycleState, family, limit, offset });

  return json({ data: models });
};

