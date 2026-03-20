import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getPolicy,
  getPolicyVersionEventByVersion,
  insertPolicyVersionEvent,
  listPolicyVersionEvents,
  updatePolicy,
} from "$lib/server/db";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const ctx = await getWorkspaceAndActor(locals);
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
