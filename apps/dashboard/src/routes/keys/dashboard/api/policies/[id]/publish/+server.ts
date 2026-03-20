import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getPolicy,
  updatePolicy,
  insertPolicyVersionEvent,
  listPolicyVersionEvents,
  getOrCreateDefaultWorkspace,
  getProject,
} from "$lib/server/db";

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

export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    const ctx = await policyScope(locals);
    if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
    const policy = await getPolicy(params.id, ctx.workspaceId);
    if (!policy) return json({ error: "Not found" }, { status: 404 });

    const history = await listPolicyVersionEvents(params.id, ctx.workspaceId, 1);
    const nextVersion = Math.max(1, (history[0]?.version ?? 0) + 1);
    const updated = await updatePolicy(params.id, ctx.workspaceId, {
      status: "active",
      updatedBy: ctx.actorId,
      updatedVia: ctx.actorType,
      changeSummary: `Published policy version ${nextVersion}`,
    });
    if (!updated) return json({ error: "Not found" }, { status: 404 });

    await insertPolicyVersionEvent({
      policyId: params.id,
      workspaceId: ctx.workspaceId,
      version: nextVersion,
      action: "publish",
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      summary: `Published policy version ${nextVersion}`,
      policySnapshot: updated as unknown as Record<string, unknown>,
    });

    return json({ data: { policy: updated, publishedVersion: nextVersion } });
  } catch (e) {
    console.error("[policy.publish] internal error:", e);
    return json({ error: "internal_error", detail: "policy_publish_failed" }, { status: 500 });
  }
};
