import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getPolicy, listPolicyVersionEvents, getOrCreateDefaultWorkspace, getProject } from "$lib/server/db";

async function policyScope(locals: App.Locals): Promise<{ workspaceId: string; actorId: string; actorType: string } | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "management_key") return null;
  if (locals.user.authType === "gateway_key") {
    const projectId = locals.user.projectIdForKey;
    if (!projectId) return null;
    const project = await getProject(projectId, locals.user.uid);
    if (!project) return null;
    const workspaceId = project.workspaceId ?? (await getOrCreateDefaultWorkspace(locals.user.uid)).id;
    return { workspaceId, actorId: locals.user.uid, actorType: "gateway_key" };
  }
  const ws = await getOrCreateDefaultWorkspace(locals.user.uid);
  return { workspaceId: ws.id, actorId: locals.user.uid, actorType: "user" };
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    const ctx = await policyScope(locals);
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
