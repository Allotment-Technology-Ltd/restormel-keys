import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getPolicy,
  getPolicyVersionEventByVersion,
  insertPolicyVersionEvent,
  listPolicyVersionEvents,
  updatePolicy,
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

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const ctx = await policyScope(locals);
    if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
    const policy = await getPolicy(params.id, ctx.workspaceId);
    if (!policy) return json({ error: "Not found" }, { status: 404 });

    let body: { toVersion?: number };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }
    let targetVersion = body.toVersion;
    if (!targetVersion) {
      const history = await listPolicyVersionEvents(params.id, ctx.workspaceId, 20);
      targetVersion = history.at(-1)?.version;
    }
    if (!targetVersion) return json({ error: "rollback_target_not_found" }, { status: 404 });
    const snapshot = await getPolicyVersionEventByVersion(params.id, ctx.workspaceId, targetVersion);
    if (!snapshot?.policySnapshot) return json({ error: "rollback_snapshot_missing" }, { status: 409 });

    const raw = snapshot.policySnapshot;
    const updated = await updatePolicy(params.id, ctx.workspaceId, {
      name: typeof raw.name === "string" ? raw.name : policy.name,
      type: typeof raw.type === "string" ? raw.type : policy.type,
      status: typeof raw.status === "string" ? raw.status : policy.status,
      ruleDefinition:
        raw.ruleDefinition && typeof raw.ruleDefinition === "object"
          ? (raw.ruleDefinition as Record<string, unknown>)
          : policy.ruleDefinition,
      updatedBy: ctx.actorId,
      updatedVia: ctx.actorType,
      changeSummary: `Rolled back policy to version ${targetVersion}`,
    });
    if (!updated) return json({ error: "Not found" }, { status: 404 });

    await insertPolicyVersionEvent({
      policyId: params.id,
      workspaceId: ctx.workspaceId,
      version: targetVersion,
      action: "rollback",
      actorId: ctx.actorId,
      actorType: ctx.actorType,
      summary: `Rolled back policy to version ${targetVersion}`,
      policySnapshot: updated as unknown as Record<string, unknown>,
    });

    return json({ data: { policy: updated, rolledBackToVersion: targetVersion } });
  } catch (e) {
    console.error("[policy.rollback] internal error:", e);
    return json({ error: "internal_error", detail: "policy_rollback_failed" }, { status: 500 });
  }
};
