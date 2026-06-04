import { redirect, json } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { pipelineWizardHref } from "$lib/connect/pipeline-config";
import { microsoftAuthorizeUrl, microsoftOauthConfigured } from "$lib/server/connect/connectors/oauth";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  if (!microsoftOauthConfigured()) {
    throw redirect(302, pipelineWizardHref("sources", { connector_error: "microsoft_not_configured" }));
  }
  const redirectUri = `${url.origin}${DASHBOARD_BASE}/api/connect/sources/connectors/microsoft/callback`;
  const state = Buffer.from(JSON.stringify({ ws: ctx.workspaceId, n: crypto.randomUUID() })).toString("base64url");
  throw redirect(302, microsoftAuthorizeUrl({ redirectUri, state }));
};
