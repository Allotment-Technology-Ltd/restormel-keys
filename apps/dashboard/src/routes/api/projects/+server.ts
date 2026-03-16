import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  listProjects,
  listProjectsByWorkspace,
  getProject,
  createProject,
} from "$lib/server/db";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  let projects;
  if (locals.user.authType === "gateway_key" && locals.user.projectIdForKey) {
    const project = await getProject(locals.user.projectIdForKey, locals.user.uid);
    projects = project ? [project] : [];
  } else if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    projects = await listProjectsByWorkspace(locals.user.workspaceId);
  } else {
    projects = await listProjects(locals.user.uid);
  }
  return json({ data: projects });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  if (locals.user.authType === "gateway_key" || locals.user.authType === "management_key") {
    return json({ error: "Key auth cannot create projects" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "Unnamed project";
  const project = await createProject(locals.user.uid, name || "Unnamed project");
  return json({ data: project }, { status: 201 });
};
