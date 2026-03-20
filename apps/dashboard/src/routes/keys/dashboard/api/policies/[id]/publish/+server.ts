import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { getPolicy, updatePolicy, insertPolicyVersionEvent, listPolicyVersionEvents } from "$lib/server/db";

export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    const ctx = await getWorkspaceAndActor(locals);
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
