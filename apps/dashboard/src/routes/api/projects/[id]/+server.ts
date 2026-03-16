import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProject, updateProject, deleteProject } from "$lib/server/db";

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const project = await getProject(params.id, locals.user.uid);
  if (!project) return json({ error: "Not found" }, { status: 404 });
  return json({ data: project });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name === undefined) return json({ error: "Missing name" }, { status: 400 });
  const ok = await updateProject(params.id, locals.user.uid, name);
  if (!ok) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const ok = await deleteProject(params.id, locals.user.uid);
  if (!ok) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};
