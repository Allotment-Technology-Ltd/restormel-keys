/**
 * GET    /connect/v1/webhooks/{webhookId}?workspace_id= — read one
 * DELETE /connect/v1/webhooks/{webhookId}?workspace_id= — remove
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  handleConnectWebhookGet,
  handleConnectWebhookDelete,
} from "$lib/server/connect-v1/webhook-handler";

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const outcome = await handleConnectWebhookGet({
    locals,
    webhookId: params.webhookId,
    workspaceId,
    projectId,
  });
  return json(outcome.body, { status: outcome.status });
};

export const DELETE: RequestHandler = async ({ params, url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const outcome = await handleConnectWebhookDelete({
    locals,
    webhookId: params.webhookId,
    workspaceId,
    projectId,
  });
  return json(outcome.body, { status: outcome.status });
};
