import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  listProviderIntegrations,
  createProviderIntegration,
} from "$lib/server/db";

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const list = await listProviderIntegrations(ctx.workspaceId);
  return json({ data: list });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  let body: { providerType?: string; displayName?: string; credentialRef?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const providerType = typeof body.providerType === "string" ? body.providerType.trim() : "";
  if (!providerType) return json({ error: "providerType is required" }, { status: 400 });
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
  const credentialRef = typeof body.credentialRef === "string" ? body.credentialRef.trim() : undefined;
  const created = await createProviderIntegration({
    workspaceId: ctx.workspaceId,
    providerType,
    displayName,
    credentialRef: credentialRef || undefined,
    createdBy: ctx.actorType === "user" ? ctx.actorId : undefined,
    actorId: ctx.actorId,
    actorType: ctx.actorType,
  });
  return json({ data: created }, { status: 201 });
};
