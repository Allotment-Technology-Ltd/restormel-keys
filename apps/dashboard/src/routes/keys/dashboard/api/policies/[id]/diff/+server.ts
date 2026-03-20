import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getPolicy, getPolicyVersionEventByVersion } from "$lib/server/db";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const ctx = await getWorkspaceAndActor(locals);
    if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
    const current = await getPolicy(params.id, ctx.workspaceId);
    if (!current) return json({ error: "Not found" }, { status: 404 });

    let body: { fromVersion?: number; toVersion?: number };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }
    const from = body.fromVersion ? await getPolicyVersionEventByVersion(params.id, ctx.workspaceId, body.fromVersion) : null;
    const to = body.toVersion ? await getPolicyVersionEventByVersion(params.id, ctx.workspaceId, body.toVersion) : null;
    const fromSnapshot = (from?.policySnapshot ?? current) as Record<string, unknown>;
    const toSnapshot = (to?.policySnapshot ?? current) as Record<string, unknown>;
    const keys = new Set([...Object.keys(fromSnapshot), ...Object.keys(toSnapshot)]);
    const changes = [...keys]
      .filter((k) => JSON.stringify(fromSnapshot[k]) !== JSON.stringify(toSnapshot[k]))
      .map((k) => ({ field: k, from: fromSnapshot[k] ?? null, to: toSnapshot[k] ?? null }));

    return json({ data: { changes, fromVersion: body.fromVersion ?? null, toVersion: body.toVersion ?? null } });
  } catch (e) {
    console.error("[policy.diff] internal error:", e);
    return json({ error: "internal_error", detail: "policy_diff_failed" }, { status: 500 });
  }
};
