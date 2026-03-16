import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  getProviderIntegration,
  updateProviderIntegration,
  deleteProviderIntegration,
} from "$lib/server/db";

export const GET: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const integration = await getProviderIntegration(params.id, ctx.workspaceId);
  if (!integration) return json({ error: "Not found" }, { status: 404 });
  return json({ data: integration });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  let body: { displayName?: string; status?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const updates: { displayName?: string; status?: string } = {};
  if (typeof body.displayName === "string") updates.displayName = body.displayName.trim();
  if (typeof body.status === "string") updates.status = body.status.trim();
  const updated = await updateProviderIntegration(
    params.id,
    ctx.workspaceId,
    updates,
    { actorId: ctx.actorId, actorType: ctx.actorType }
  );
  if (!updated) return json({ error: "Not found" }, { status: 404 });
  return json({ data: updated });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const deleted = await deleteProviderIntegration(params.id, ctx.workspaceId, {
    actorId: ctx.actorId,
    actorType: ctx.actorType,
  });
  if (!deleted) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};
