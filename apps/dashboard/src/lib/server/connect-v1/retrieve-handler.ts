/**
 * POST /connect/v1/retrieve — Knowledge Retrieve (BYO graph store).
 */
import { ConnectRetrieveRequestSchema } from "@restormel/contracts/connect";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import { executeConnectRetrieve } from "./retrieve-service.js";

export type ConnectRetrieveHandlerOutcome =
  | { ok: true; status: 200 | 206; body: import("@restormel/contracts/connect").ConnectRetrieveResponse; requestId: string }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function handleKnowledgeRetrieve(args: {
  locals: App.Locals;
  body: unknown;
  requestId: string;
}): Promise<ConnectRetrieveHandlerOutcome> {
  const parsed = ConnectRetrieveRequestSchema.safeParse(args.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "invalid_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
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

  const outcome = await executeConnectRetrieve({
    auth,
    request: parsed.data,
    requestId: args.requestId,
  });
  if (!outcome.ok) {
    return { ok: false, status: outcome.status, body: outcome.body };
  }
  // HTTP 206 Partial Content when retrieval is degraded (O2).
  const status = outcome.body.metadata?.retrieval_degraded ? 206 : 200;
  return { ok: true, status, body: outcome.body, requestId: args.requestId };
}
