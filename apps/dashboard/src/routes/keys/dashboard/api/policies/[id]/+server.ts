import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  getPolicy,
  updatePolicy,
  deletePolicy,
  getOrCreateDefaultWorkspace,
  getProject,
  listPolicyBindings,
} from "$lib/server/db";

async function gatewayPolicyScope(
  locals: App.Locals
): Promise<{ workspaceId: string; projectId: string; actorId: string } | null> {
  if (!locals.user || locals.user.authType !== "gateway_key") return null;
  const projectId = locals.user.projectIdForKey;
  if (!projectId) return null;
  const project = await getProject(projectId, locals.user.uid);
  if (!project) return null;
  const workspaceId = project.workspaceId ?? (await getOrCreateDefaultWorkspace(locals.user.uid)).id;
  return { workspaceId, projectId, actorId: locals.user.uid };
}

export const GET: RequestHandler = async ({ params, locals }) => {
  const gateway = await gatewayPolicyScope(locals);
  if (gateway) {
    const policy = await getPolicy(params.id, gateway.workspaceId);
    if (!policy) return json({ error: "Not found" }, { status: 404 });
    const bindings = await listPolicyBindings(policy.id, gateway.workspaceId);
    const matchesProject = bindings.some(
      (b) => b.targetType === "project" && b.targetId === gateway.projectId
    );
    if (!matchesProject) return json({ error: "Not found" }, { status: 404 });
    return json({ data: policy });
  }
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const policy = await getPolicy(params.id, ctx.workspaceId);
  if (!policy) return json({ error: "Not found" }, { status: 404 });
  return json({ data: policy });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  let body: {
    name?: string;
    type?: string;
    status?: string;
    ruleDefinition?: Record<string, unknown> | null;
    updatedVia?: string;
    changeSummary?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const updates: Parameters<typeof updatePolicy>[2] = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.type === "string") updates.type = body.type.trim();
  if (typeof body.status === "string") updates.status = body.status.trim();
  if (body.ruleDefinition !== undefined) updates.ruleDefinition = body.ruleDefinition;
  if (typeof body.updatedVia === "string") updates.updatedVia = body.updatedVia.trim();
  updates.updatedBy = ctx.actorId;
  if (typeof body.changeSummary === "string") updates.changeSummary = body.changeSummary.trim();
  const policy = await updatePolicy(params.id, ctx.workspaceId, updates);
  if (!policy) return json({ error: "Not found" }, { status: 404 });
  return json({ data: policy });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const ok = await deletePolicy(params.id, ctx.workspaceId);
  if (!ok) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};
