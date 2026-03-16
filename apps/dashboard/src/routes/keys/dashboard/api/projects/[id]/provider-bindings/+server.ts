import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getProject,
  getProjectInWorkspace,
  listProviderBindingsByProject,
} from "$lib/server/db";

async function getProjectForRequest(
  projectId: string,
  locals: App.Locals
): Promise<Awaited<ReturnType<typeof getProject>> | null> {
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

/** GET: list provider bindings for this project (for frontend). Integration summary included; credentialRef never exposed. */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const project = await getProjectForRequest(params.id, locals);
  if (!project) return json({ error: "Not found" }, { status: 404 });
  const bindings = await listProviderBindingsByProject(params.id);
  return json({ data: bindings });
};
