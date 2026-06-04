import { redirect, json } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { pipelineWizardHref } from "$lib/connect/pipeline-config";
import { microsoftExchangeCode } from "$lib/server/connect/connectors/oauth";
import { createOAuthConnection } from "$lib/server/connect/connections-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const pipelineSources = (params: Record<string, string>) => pipelineWizardHref("sources", params);

export const GET: RequestHandler = async ({ locals, url }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) throw redirect(302, pipelineSources({ connector_error: "microsoft_denied" }));

  let ok = false;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { ws?: string };
    if (decoded.ws !== ctx.workspaceId) throw new Error("state mismatch");
    const redirectUri = `${url.origin}${DASHBOARD_BASE}/api/connect/sources/connectors/microsoft/callback`;
    const tokens = await microsoftExchangeCode({ code, redirectUri });
    if (!tokens.refresh_token) throw new Error("no refresh token returned");
    await createOAuthConnection({
      workspaceId: ctx.workspaceId,
      provider: "sharepoint",
      label: "SharePoint / OneDrive",
      refreshToken: tokens.refresh_token,
    });
    ok = true;
  } catch {
    ok = false;
  }
  throw redirect(
    302,
    ok
      ? pipelineSources({ connector_connected: "sharepoint" })
      : pipelineSources({ connector_error: "microsoft_failed" }),
  );
};
