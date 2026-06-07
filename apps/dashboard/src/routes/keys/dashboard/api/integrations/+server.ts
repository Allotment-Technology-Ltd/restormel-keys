import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { isGatewayProviderType } from "$lib/server/module-gates";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  listProviderIntegrations,
  createProviderIntegration,
  getWorkspace,
} from "$lib/server/db";
import { bootstrapRestormelTestingIntegration } from "$lib/server/testing-bootstrap";

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "unauthorized", message: "Session or management key required" }, { status: 401 });
  const list = await listProviderIntegrations(ctx.workspaceId);
  return json({ data: list });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "unauthorized", message: "Session or management key required" }, { status: 401 });
  let body: { providerType?: string; displayName?: string; credentialRef?: string; apiKey?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const providerType = typeof body.providerType === "string" ? body.providerType.trim() : "";
  if (!providerType) return json({ error: "providerType is required" }, { status: 400 });
  const flags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
  if (isGatewayProviderType(providerType, flags)) {
    return json({ error: "module_disabled", module: "gatewayProviders" }, { status: 404 });
  }
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
  const credentialRef = typeof body.credentialRef === "string" ? body.credentialRef.trim() : undefined;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
  try {
    const created = await createProviderIntegration({
      workspaceId: ctx.workspaceId,
      providerType,
      displayName,
      credentialRef: credentialRef || undefined,
      apiKey: apiKey?.trim() ? apiKey.trim() : undefined,
      createdBy: ctx.actorType === "user" ? ctx.actorId : undefined,
      actorId: ctx.actorId,
      actorType: ctx.actorType,
    });
    try {
      let runAsUserId = ctx.actorId;
      if (ctx.actorType === "management_key") {
        const ws = await getWorkspace(ctx.workspaceId);
        if (ws?.ownerUserId) runAsUserId = ws.ownerUserId;
      }
      await bootstrapRestormelTestingIntegration(runAsUserId, {
        actorId: ctx.actorId,
        actorType: ctx.actorType,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[testing-bootstrap]", msg.slice(0, 120));
    }
    return json({ data: created }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("RESTORMEL_CREDENTIALS_ENCRYPTION_KEY")) {
      return json(
        { error: "server_misconfigured", message: "Hosted API key storage is not configured on this deployment" },
        { status: 503 }
      );
    }
    throw e;
  }
};
