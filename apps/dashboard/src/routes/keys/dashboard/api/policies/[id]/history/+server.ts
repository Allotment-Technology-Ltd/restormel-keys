import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { getPolicy, listPolicyVersionEvents } from "$lib/server/db";

export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    const ctx = await getWorkspaceAndActor(locals);
    if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
    const policy = await getPolicy(params.id, ctx.workspaceId);
    if (!policy) return json({ error: "Not found" }, { status: 404 });
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 50;
    const events = await listPolicyVersionEvents(params.id, ctx.workspaceId, limit);
    return json({ data: events });
  } catch (e) {
    console.error("[policy.history] internal error:", e);
    return json({ error: "internal_error", detail: "policy_history_failed" }, { status: 500 });
  }
};
