import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { deleteProviderBinding } from "$lib/server/db";

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const deleted = await deleteProviderBinding(params.bindingId, ctx.workspaceId, {
    actorId: ctx.actorId,
    actorType: ctx.actorType,
  });
  if (!deleted) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};
