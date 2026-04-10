import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  createWorkspaceWebhook,
  deleteWorkspaceWebhook,
  listWorkspaceWebhooks,
} from "$lib/server/db";
import {
  generateWebhookSigningSecret,
} from "$lib/server/webhook-delivery";
import { isCredentialEncryptionConfigured } from "$lib/server/credential-crypto";

function isValidHttpsUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    const webhooks = await listWorkspaceWebhooks(ctx.workspaceId);
    return json({ data: webhooks });
  } catch (e) {
    console.error("[webhooks] list failed:", e);
    return json({ error: "Failed to list webhooks" }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  if (!isCredentialEncryptionConfigured()) {
    return json(
      {
        error: "webhooks_unavailable",
        detail: "RESTORMEL_CREDENTIALS_ENCRYPTION_KEY must be set to store webhook signing secrets",
      },
      { status: 503 },
    );
  }
  let body: { url?: unknown; event_types?: unknown };
  try {
    body = (await request.json()) as { url?: unknown; event_types?: unknown };
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !isValidHttpsUrl(url)) {
    return json({ error: "url must be a valid http(s) URL" }, { status: 400 });
  }
  let eventTypes: string[] | undefined;
  if (body.event_types !== undefined) {
    if (!Array.isArray(body.event_types) || !body.event_types.every((x) => typeof x === "string")) {
      return json({ error: "event_types must be an array of strings" }, { status: 400 });
    }
    eventTypes = body.event_types.map((s) => s.trim()).filter(Boolean);
  }
  const secret = generateWebhookSigningSecret();
  const created = await createWorkspaceWebhook({
    workspaceId: ctx.workspaceId,
    url,
    eventTypes,
    signingSecretPlaintext: secret,
  });
  if (!created.ok) {
    return json({ error: "webhook_create_failed", detail: created.error }, { status: 500 });
  }
  return json({
    data: {
      webhook: created.record,
      signing_secret: created.signingSecretPlaintext,
    },
  });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "Missing id query parameter" }, { status: 400 });
  try {
    const ok = await deleteWorkspaceWebhook(ctx.workspaceId, id);
    if (!ok) return json({ error: "Not found" }, { status: 404 });
    return json({ data: { deleted: true } });
  } catch (e) {
    console.error("[webhooks] delete failed:", e);
    return json({ error: "Failed to delete webhook" }, { status: 500 });
  }
};
