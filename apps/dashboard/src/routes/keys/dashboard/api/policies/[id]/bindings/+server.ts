import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { getPolicy, listPolicyBindings, createPolicyBinding } from "$lib/server/db";

/** GET: list bindings for policy. */
export const GET: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const policy = await getPolicy(params.id, ctx.workspaceId);
  if (!policy) return json({ error: "Not found" }, { status: 404 });
  const data = await listPolicyBindings(params.id, ctx.workspaceId);
  return json({ data });
};

/** POST: create binding. Body: targetType, targetId. targetType: workspace | project | environment | route | customer_tenant */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  let body: { targetType?: string; targetId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const targetType = typeof body.targetType === "string" ? body.targetType.trim() : "";
  const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
  if (!targetType || !targetId) return json({ error: "targetType and targetId are required" }, { status: 400 });
  const binding = await createPolicyBinding({
    policyId: params.id,
    targetType,
    targetId,
    workspaceId: ctx.workspaceId,
  });
  if (!binding) return json({ error: "Not found" }, { status: 404 });
  return json({ data: binding }, { status: 201 });
};
