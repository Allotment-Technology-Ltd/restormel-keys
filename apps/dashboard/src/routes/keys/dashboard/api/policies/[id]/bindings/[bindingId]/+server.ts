import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { deletePolicyBinding } from "$lib/server/db";

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const ok = await deletePolicyBinding(params.bindingId, params.id, ctx.workspaceId);
  if (!ok) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};
