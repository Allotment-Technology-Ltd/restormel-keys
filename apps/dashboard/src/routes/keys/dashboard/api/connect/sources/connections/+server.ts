/**
 * Cloud connector connections: list and create. S3 is credential-based (created
 * here); Google Drive / SharePoint connections are created via their OAuth callback.
 */
import { json } from "@sveltejs/kit";
import { ConnectS3ConnectionCreateSchema } from "@restormel/contracts/connect";
import { ConnectionConfigError, createS3Connection, listConnections } from "$lib/server/connect/connections-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import {
  googleOauthConfigured,
  microsoftOauthConfigured,
} from "$lib/server/connect/connectors/oauth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const connections = await listConnections(ctx.workspaceId);
  return json({
    connections,
    providers: {
      s3: true,
      google_drive: googleOauthConfigured(),
      sharepoint: microsoftOauthConfigured(),
    },
  });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = ConnectS3ConnectionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  try {
    const connection = await createS3Connection(ctx.workspaceId, parsed.data);
    return json({ connection }, { status: 201 });
  } catch (e) {
    if (e instanceof ConnectionConfigError) {
      return json({ error: "server_misconfigured", message: e.message }, { status: 503 });
    }
    throw e;
  }
};
