import { redirect } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { pipelineWizardHref } from "$lib/connect/pipeline-config";
import { googleAuthorizeUrl, googleOauthConfigured } from "$lib/server/connect/connectors/oauth";
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
  if (!googleOauthConfigured()) {
    throw redirect(302, pipelineWizardHref("sources", { connector_error: "google_not_configured" }));
  }
  const redirectUri = `${url.origin}${DASHBOARD_BASE}/api/connect/sources/connectors/google/callback`;
  const state = Buffer.from(JSON.stringify({ ws: ctx.workspaceId, n: crypto.randomUUID() })).toString("base64url");
  throw redirect(302, googleAuthorizeUrl({ redirectUri, state }));
};
