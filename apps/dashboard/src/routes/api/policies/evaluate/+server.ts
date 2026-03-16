import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { evaluatePolicies } from "$lib/server/db";

/** POST: evaluate policies for a context (for testing/debug). Body: workspaceId, projectId?, environmentId?, routeId?, modelId?, providerType?, modelLifecycleState? */
export const POST: RequestHandler = async ({ request, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  let body: {
    workspaceId?: string;
    projectId?: string;
    environmentId?: string;
    routeId?: string;
    modelId?: string;
    providerType?: string;
    modelLifecycleState?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const workspaceId = body.workspaceId ?? ctx.workspaceId;
  if (workspaceId !== ctx.workspaceId) return json({ error: "workspaceId must match your workspace" }, { status: 403 });
  const violations = await evaluatePolicies({
    workspaceId,
    projectId: body.projectId,
    environmentId: body.environmentId,
    routeId: body.routeId,
    modelId: body.modelId,
    providerType: body.providerType,
    modelLifecycleState: body.modelLifecycleState,
  });
  return json({ data: { allowed: violations.length === 0, violations } });
};
