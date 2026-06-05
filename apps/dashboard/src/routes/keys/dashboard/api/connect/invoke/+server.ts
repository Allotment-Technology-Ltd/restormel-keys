import { json } from "@sveltejs/kit";
import {
  ConnectRetrieveRequestSchema,
  CONNECT_API_CONTRACT_VERSION,
} from "@restormel/contracts/connect";
import { authorizeKnowledgeWorkspaceRequest } from "$lib/server/connect-v1/auth.js";
import { executeConnectRetrieve } from "$lib/server/connect-v1/retrieve-service.js";
import type { RequestHandler } from "./$types";

const CONNECT_AGENT_TOOLS = ["connect.search", "connect.get_context_for", "connect.retrieve"] as const;
type ConnectAgentTool = (typeof CONNECT_AGENT_TOOLS)[number];

function isConnectAgentTool(s: string): s is ConnectAgentTool {
  return (CONNECT_AGENT_TOOLS as readonly string[]).includes(s);
}

function badRequest(code: string, message: string) {
  return json({ ok: false, code, message }, { status: 400 });
}

/**
 * HTTP mirror of Connect agent MCP tools (session or Gateway key).
 * Body: { tool, payload } where tool is connect.search | connect.get_context_for | connect.retrieve
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("RST_CONNECT_HTTP_JSON", "Request body must be JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("RST_CONNECT_HTTP_BODY", "Body must be an object with tool and payload.");
  }
  const o = body as Record<string, unknown>;
  const tool = o.tool;
  const payload = o.payload;
  if (typeof tool !== "string" || !isConnectAgentTool(tool)) {
    return badRequest(
      "RST_CONNECT_UNKNOWN_TOOL",
      `Unknown tool. Valid: ${CONNECT_AGENT_TOOLS.join(", ")}.`,
    );
  }
  if (payload !== undefined && (typeof payload !== "object" || payload === null || Array.isArray(payload))) {
    return badRequest("RST_CONNECT_HTTP_PAYLOAD", "payload must be a plain object when present.");
  }
  const p = (payload ?? {}) as Record<string, unknown>;

  const workspaceId =
    (typeof p.workspace_id === "string" ? p.workspace_id : null) ??
    process.env.RESTORMEL_WORKSPACE_ID?.trim();
  if (!workspaceId) {
    return badRequest("RST_CONNECT_WORKSPACE", "payload.workspace_id is required.");
  }

  let query: string;
  let seedClaimId: string | undefined;
  if (tool === "connect.get_context_for") {
    if (typeof p.topic !== "string" || !p.topic.trim()) {
      return badRequest("RST_CONNECT_HTTP_ARG", "payload.topic (string) is required for connect.get_context_for.");
    }
    query = p.topic.trim();
    if (typeof p.seed_claim_id === "string" && p.seed_claim_id.trim()) {
      seedClaimId = p.seed_claim_id.trim();
    }
  } else {
    if (tool === "connect.retrieve" && typeof p.requestJson === "string" && p.requestJson.trim()) {
      try {
        const legacy = JSON.parse(p.requestJson) as Record<string, unknown>;
        const parsed = ConnectRetrieveRequestSchema.safeParse(legacy);
        if (!parsed.success) {
          return badRequest("RST_CONNECT_INVALID", parsed.error.issues.map((i) => i.message).join("; "));
        }
        const auth = await authorizeKnowledgeWorkspaceRequest({
          locals,
          workspaceId: parsed.data.workspace_id,
          projectId: parsed.data.project_id,
        });
        if ("error" in auth && "status" in auth) {
          return json({ ok: false, error: auth.error, message: auth.message }, { status: auth.status });
        }
        const requestId = crypto.randomUUID();
        const outcome = await executeConnectRetrieve({
          auth,
          request: parsed.data,
          requestId,
        });
        if (!outcome.ok) return json({ ok: false, ...outcome.body }, { status: outcome.status });
        return json({ ok: true, tool, ...outcome.body });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return badRequest("RST_CONNECT_JSON", msg);
      }
    }
    if (typeof p.query !== "string" || !p.query.trim()) {
      return badRequest("RST_CONNECT_HTTP_ARG", "payload.query (string) is required.");
    }
    query = p.query.trim();
  }

  const retrieveBody = {
    workspace_id: workspaceId,
    query,
    contract_version: CONNECT_API_CONTRACT_VERSION,
    ...(typeof p.project_id === "string" ? { project_id: p.project_id } : {}),
    ...(typeof p.depth === "string" ? { depth: p.depth } : {}),
    ...(typeof p.max_claims === "number" ? { max_claims: p.max_claims } : {}),
    ...(typeof p.domain_hint === "string" ? { domain_hint: p.domain_hint } : {}),
    ...(seedClaimId ? { seed_claim_id: seedClaimId } : {}),
  };

  const parsed = ConnectRetrieveRequestSchema.safeParse(retrieveBody);
  if (!parsed.success) {
    return badRequest("RST_CONNECT_INVALID", parsed.error.issues.map((i) => i.message).join("; "));
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals,
    workspaceId: parsed.data.workspace_id,
    projectId: parsed.data.project_id,
  });
  if ("error" in auth && "status" in auth) {
    return json({ ok: false, error: auth.error, message: auth.message }, { status: auth.status });
  }

  const requestId = crypto.randomUUID();
  const outcome = await executeConnectRetrieve({
    auth,
    request: parsed.data,
    requestId,
  });
  if (!outcome.ok) return json({ ok: false, ...outcome.body }, { status: outcome.status });
  return json({ ok: true, tool, ...outcome.body });
};
