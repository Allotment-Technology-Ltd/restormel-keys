import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getPolicy,
  getPolicyVersionEventByVersion,
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
