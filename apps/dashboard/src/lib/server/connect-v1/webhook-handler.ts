/**
 * Public Connect ingest webhook registration (I1).
 *
 * POST   /connect/v1/webhooks            — register
 * GET    /connect/v1/webhooks            — list (workspace-scoped)
 * GET    /connect/v1/webhooks/{id}       — read one
 * DELETE /connect/v1/webhooks/{id}       — remove
 */
import {
  CONNECT_API_CONTRACT_VERSION,
  ConnectWebhookCreateRequestSchema,
  type ConnectWebhook,
} from "@restormel/contracts/connect";
import {
  createConnectWebhook,
  listConnectWebhooks,
  getConnectWebhook,
  deleteConnectWebhook,
  type ConnectWebhookRecord,
} from "$lib/server/neon";
import { generateWebhookSigningSecret } from "$lib/server/webhook-delivery";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";

export type ConnectWebhookHandlerOutcome =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

function toPublicWebhook(rec: ConnectWebhookRecord): ConnectWebhook {
  return {
    webhook_id: rec.id,
    workspace_id: rec.workspaceId,
    url: rec.url,
    events: rec.events as ConnectWebhook["events"],
    quality_threshold: rec.qualityThreshold,
    active: rec.active,
    created_at: new Date(rec.createdAt).toISOString(),
  };
}

export async function handleConnectWebhookCreate(args: {
  locals: App.Locals;
  body: unknown;
}): Promise<ConnectWebhookHandlerOutcome> {
  const parsed = ConnectWebhookCreateRequestSchema.safeParse(args.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
    };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId: parsed.data.workspace_id,
    projectId: parsed.data.project_id,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  const signingSecret = parsed.data.secret ?? generateWebhookSigningSecret();
  const created = await createConnectWebhook({
    workspaceId: auth.workspaceId,
    projectId: auth.projectId,
    url: parsed.data.url,
    events: parsed.data.events,
    qualityThreshold: parsed.data.quality_threshold ?? null,
    signingSecretPlaintext: signingSecret,
  });
  if (!created.ok) {
    return {
      ok: false,
      status: 500,
      body: { error: "webhook_create_failed", message: created.error },
    };
  }

  return {
    ok: true,
    status: 201,
    body: {
      ...toPublicWebhook(created.record),
      // The signing secret is returned exactly once, at registration time.
      signing_secret: signingSecret,
    },
  };
}

export async function handleConnectWebhookList(args: {
  locals: App.Locals;
  workspaceId: string | null;
  projectId?: string;
}): Promise<ConnectWebhookHandlerOutcome> {
  if (!args.workspaceId) {
    return {
      ok: false,
      status: 400,
      body: { error: "workspace_id_required", message: "Query parameter workspace_id is required" },
    };
  }
  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId: args.workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }
  const rows = await listConnectWebhooks(auth.workspaceId);
  return {
    ok: true,
    status: 200,
    body: {
      contract_version: CONNECT_API_CONTRACT_VERSION,
      webhooks: rows.map(toPublicWebhook),
    },
  };
}

export async function handleConnectWebhookGet(args: {
  locals: App.Locals;
  webhookId: string;
  workspaceId: string | null;
  projectId?: string;
}): Promise<ConnectWebhookHandlerOutcome> {
  if (!args.workspaceId) {
    return {
      ok: false,
      status: 400,
      body: { error: "workspace_id_required", message: "Query parameter workspace_id is required" },
    };
  }
  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId: args.workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }
  const rec = await getConnectWebhook(auth.workspaceId, args.webhookId);
  if (!rec) {
    return { ok: false, status: 404, body: { error: "not_found", message: "Webhook not found" } };
  }
  return { ok: true, status: 200, body: toPublicWebhook(rec) as unknown as Record<string, unknown> };
}

export async function handleConnectWebhookDelete(args: {
  locals: App.Locals;
  webhookId: string;
  workspaceId: string | null;
  projectId?: string;
}): Promise<ConnectWebhookHandlerOutcome> {
  if (!args.workspaceId) {
    return {
      ok: false,
      status: 400,
      body: { error: "workspace_id_required", message: "Query parameter workspace_id is required" },
    };
  }
  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId: args.workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }
  const deleted = await deleteConnectWebhook(auth.workspaceId, args.webhookId);
  if (!deleted) {
    return { ok: false, status: 404, body: { error: "not_found", message: "Webhook not found" } };
  }
  return { ok: true, status: 200, body: { deleted: true, webhook_id: args.webhookId } };
}
