import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  getProviderIntegration,
  listProviderBindingsByIntegration,
  createProviderBinding,
} from "$lib/server/db";

export const GET: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const integration = await getProviderIntegration(params.id, ctx.workspaceId);
  if (!integration) return json({ error: "Not found" }, { status: 404 });
  const bindings = await listProviderBindingsByIntegration(params.id);
  return json({ data: bindings });
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  let body: { projectId?: string; environmentId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!projectId) return json({ error: "projectId is required" }, { status: 400 });
  const environmentId =
    typeof body.environmentId === "string" ? body.environmentId.trim() || null : null;
  const binding = await createProviderBinding({
    providerIntegrationId: params.id,
    projectId,
    environmentId,
    workspaceId: ctx.workspaceId,
    actorId: ctx.actorId,
    actorType: ctx.actorType,
  });
  if (!binding) return json({ error: "Not found or integration not in workspace" }, { status: 404 });
  return json({ data: binding }, { status: 201 });
};
