/**
 * POST /connect/v1/graph — higher-order graph orchestrator operations (BYO graph store).
 */
import { ConnectGraphOpRequestSchema } from "@restormel/contracts/connect";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import { executeConnectGraphOp } from "./graph-orchestrator-service.js";

export type ConnectGraphOpHandlerOutcome =
  | {
      ok: true;
      status: 200;
      body: import("@restormel/contracts/connect").ConnectGraphOpResponse;
      requestId: string;
    }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function handleConnectGraphOp(args: {
  locals: App.Locals;
  body: unknown;
  requestId: string;
}): Promise<ConnectGraphOpHandlerOutcome> {
  const parsed = ConnectGraphOpRequestSchema.safeParse(args.body);
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

  const outcome = await executeConnectGraphOp({
    auth,
    request: parsed.data,
    requestId: args.requestId,
  });
  if (!outcome.ok) {
    return { ok: false, status: outcome.status, body: outcome.body };
  }
  return { ok: true, status: 200, body: outcome.body, requestId: args.requestId };
}
