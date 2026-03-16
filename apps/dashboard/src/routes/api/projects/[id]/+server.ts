import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProject, getProjectInWorkspace, updateProject, deleteProject } from "$lib/server/db";

async function getProjectForRequest(
  projectId: string,
  locals: App.Locals
): Promise<Awaited<ReturnType<typeof getProject>>> {
  if (locals.user?.authType === "gateway_key") {
    if (locals.user.projectIdForKey !== projectId) return null;
    return getProject(projectId, locals.user.uid);
  }
  if (locals.user?.authType === "management_key" && locals.user.workspaceId) {
    return getProjectInWorkspace(projectId, locals.user.workspaceId);
  }
  if (locals.user?.uid) return getProject(projectId, locals.user.uid);
  return null;
}

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const project = await getProjectForRequest(params.id, locals);
  if (!project) return json({ error: "Not found" }, { status: 404 });
  return json({ data: project });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const project = await getProjectForRequest(params.id, locals);
  if (!project) return json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name === undefined) return json({ error: "Missing name" }, { status: 400 });
  const ok = await updateProject(params.id, project.userId, name);
  if (!ok) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const project = await getProjectForRequest(params.id, locals);
  if (!project) return json({ error: "Not found" }, { status: 404 });
  const ok = await deleteProject(params.id, project.userId);
  if (!ok) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};
