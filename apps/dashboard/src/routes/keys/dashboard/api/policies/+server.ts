import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  listPolicies,
  createPolicy,
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

/** GET: list policies for workspace. */
export const GET: RequestHandler = async ({ locals }) => {
  const gateway = await gatewayPolicyScope(locals);
  if (gateway) {
    const policies = await listPolicies(gateway.workspaceId);
    const scoped = [];
    for (const policy of policies) {
      const bindings = await listPolicyBindings(policy.id, gateway.workspaceId);
      const matchesProject = bindings.some(
        (b) => b.targetType === "project" && b.targetId === gateway.projectId
      );
      if (matchesProject) scoped.push(policy);
    }
    return json({ data: scoped });
  }
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const data = await listPolicies(ctx.workspaceId);
  return json({ data });
};

/** POST: create policy. Body: name, type, ruleDefinition?. Types: model_allowlist, model_denylist, provider_allowlist, provider_denylist, deprecated_model_block, budget_cap, token_cap, etc. */
export const POST: RequestHandler = async ({ request, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  let body: { name?: string; type?: string; ruleDefinition?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!name || !type) return json({ error: "name and type are required" }, { status: 400 });
  const policy = await createPolicy({
    workspaceId: ctx.workspaceId,
    name,
    type,
    ruleDefinition: body.ruleDefinition ?? undefined,
    createdBy: ctx.actorType === "user" ? ctx.actorId : undefined,
    actorId: ctx.actorId,
    actorType: ctx.actorType,
  });
  return json({ data: policy }, { status: 201 });
};
