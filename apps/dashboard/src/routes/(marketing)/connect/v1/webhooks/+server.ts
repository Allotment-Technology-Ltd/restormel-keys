/**
 * POST /connect/v1/webhooks — register an ingest webhook
 * GET  /connect/v1/webhooks?workspace_id= — list workspace webhooks
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  handleConnectWebhookCreate,
  handleConnectWebhookList,
} from "$lib/server/connect-v1/webhook-handler";

export const POST: RequestHandler = async ({ request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }
  const outcome = await handleConnectWebhookCreate({ locals, body });
  return json(outcome.body, { status: outcome.status });
};

export const GET: RequestHandler = async ({ url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const outcome = await handleConnectWebhookList({ locals, workspaceId, projectId });
  return json(outcome.body, { status: outcome.status });
};
