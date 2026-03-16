import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listProjects, createProject } from "$lib/server/db";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const projects = await listProjects(locals.user.uid);
  return json({ data: projects });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "Unnamed project";
  const project = await createProject(locals.user.uid, name || "Unnamed project");
  return json({ data: project }, { status: 201 });
};
