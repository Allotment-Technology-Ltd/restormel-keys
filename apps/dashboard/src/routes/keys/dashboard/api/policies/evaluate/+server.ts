import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { evaluatePolicies, getOrCreateDefaultWorkspace, getProject } from "$lib/server/db";

/** POST: evaluate policies for a context (for testing/debug). Body: workspaceId, projectId?, environmentId?, routeId?, modelId?, providerType?, modelLifecycleState? */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
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

  // Management keys were not shipped in v1 (no create/list/revoke flow).
  // Keep this endpoint unified on session + Gateway Key.
  if (locals.user.authType === "management_key") {
    return json({ error: "Management keys are deprecated. Use Gateway Key or session." }, { status: 403 });
  }

  // Gateway-key auth: force evaluate to the key's project/workspace only.
  if (locals.user.authType === "gateway_key") {
    const projectIdForKey = locals.user.projectIdForKey;
    if (!projectIdForKey) return json({ error: "Unauthorized" }, { status: 401 });
    if (body.projectId && body.projectId !== projectIdForKey) {
      return json({ error: "projectId must match your Gateway Key project" }, { status: 403 });
    }

    const project = await getProject(projectIdForKey, locals.user.uid);
    if (!project) return json({ error: "Unauthorized or project not found" }, { status: 403 });

    const workspaceId = project.workspaceId ?? (await getOrCreateDefaultWorkspace(locals.user.uid)).id;
    if (body.workspaceId && body.workspaceId !== workspaceId) {
      return json({ error: "workspaceId must match your Gateway Key workspace" }, { status: 403 });
    }

    const violations = await evaluatePolicies({
      workspaceId,
      projectId: projectIdForKey,
      environmentId: body.environmentId,
      routeId: body.routeId,
      modelId: body.modelId,
      providerType: body.providerType,
      modelLifecycleState: body.modelLifecycleState,
    });
    return json({ data: { allowed: violations.length === 0, violations } });
  }

  // Session auth: evaluate within the signed-in user's default workspace.
  const workspace = await getOrCreateDefaultWorkspace(locals.user.uid);
  const workspaceId = body.workspaceId ?? workspace.id;
  if (workspaceId !== workspace.id) {
    return json({ error: "workspaceId must match your workspace" }, { status: 403 });
  }

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
