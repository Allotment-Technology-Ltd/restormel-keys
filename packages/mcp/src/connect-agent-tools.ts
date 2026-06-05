/**
 * Agent-native Connect MCP tools (BYO graph store → hosted retrieve REST).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { connectProxyPost, connectValidateRetrieveRequest } from "./connect-tools-logic.js";
import type { RestormelSuiteToolName } from "./suite-tool-names.js";

type ToolReg = (
  name: RestormelSuiteToolName,
  config: { description: string; inputSchema: Record<string, z.ZodType>; outputSchema: Record<string, z.ZodType> },
  handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[]; structuredContent: unknown }>,
) => void;

const connectSearchInput = {
  query: z.string().min(1).describe("Natural-language search over the workspace knowledge graph."),
  depth: z.enum(["quick", "standard", "deep"]).optional().describe("Context pack depth (default standard)."),
  workspace_id: z
    .string()
    .uuid()
    .optional()
    .describe("Keys workspace id. Defaults to RESTORMEL_WORKSPACE_ID env when omitted."),
  project_id: z.string().uuid().optional().describe("Keys project id when required by your Gateway key scope."),
  max_claims: z.number().int().positive().max(500).optional(),
  domain_hint: z.string().optional(),
};

const connectGetContextInput = {
  topic: z.string().min(1).describe("Topic label or question anchoring the subgraph."),
  seed_claim_id: z
    .string()
    .optional()
    .describe("Optional claim id from the graph explorer to seed traversal."),
  depth: z.enum(["quick", "standard", "deep"]).optional(),
  workspace_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  max_claims: z.number().int().positive().max(500).optional(),
};

const connectRetrieveOutput = {
  ok: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  contract_version: z.string().optional(),
  request_id: z.string().optional(),
  context_block: z.string().optional(),
  context_pack: z.unknown().optional(),
  graph: z.unknown().optional(),
  metadata: z
    .object({
      claims_retrieved: z.number().optional(),
      arguments_retrieved: z.number().optional(),
      retrieval_degraded: z.boolean().optional(),
      retrieval_degraded_reason: z.string().optional(),
      retrieval_degraded_code: z.string().optional(),
    })
    .optional(),
  upstreamStatus: z.number().optional(),
};

function resolveWorkspaceId(explicit?: string): string | null {
  const id = explicit?.trim() || process.env.RESTORMEL_WORKSPACE_ID?.trim();
  return id || null;
}

function resolveProjectId(explicit?: string): string | undefined {
  return explicit?.trim() || process.env.RESTORMEL_PROJECT_ID?.trim() || undefined;
}

async function callHostedRetrieve(body: Record<string, unknown>) {
  const base = process.env.RESTORMEL_CONNECT_API_BASE?.trim();
  const key = process.env.RESTORMEL_GATEWAY_KEY?.trim();
  if (!base || !key) {
    return {
      ok: false as const,
      code: "RST_CONNECT_HOSTED",
      message:
        "Set RESTORMEL_CONNECT_API_BASE and RESTORMEL_GATEWAY_KEY to call hosted retrieve (e.g. https://restormel.dev).",
    };
  }
  const proxied = await connectProxyPost({
    baseUrl: base,
    gatewayKey: key,
    path: "/connect/v1/retrieve",
    body,
  });
  if (!proxied.ok) return proxied;
  const upstream = proxied.json as Record<string, unknown>;
  return {
    ok: true as const,
    upstreamStatus: proxied.status,
    ...upstream,
  };
}

function mcpTextResult(structuredContent: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export function registerConnectAgentTools(_server: McpServer, reg: ToolReg): void {
  reg(
    "connect.search",
    {
      description:
        "Semantic search over a BYO Surreal knowledge graph. Returns structured claims, relations, and pass-specific context packs (not raw Surreal HTTP). Requires RESTORMEL_CONNECT_API_BASE + RESTORMEL_GATEWAY_KEY.",
      inputSchema: connectSearchInput,
      outputSchema: connectRetrieveOutput,
    },
    async (args) => {
      const workspaceId = resolveWorkspaceId(args.workspace_id as string | undefined);
      if (!workspaceId) {
        return mcpTextResult({
          ok: false,
          code: "RST_CONNECT_WORKSPACE",
          message: "workspace_id or RESTORMEL_WORKSPACE_ID is required.",
        });
      }
      const body: Record<string, unknown> = {
        workspace_id: workspaceId,
        query: args.query,
        depth: args.depth,
        max_claims: args.max_claims,
        domain_hint: args.domain_hint,
      };
      const projectId = resolveProjectId(args.project_id as string | undefined);
      if (projectId) body.project_id = projectId;
      const r = await callHostedRetrieve(body);
      return mcpTextResult(r);
    },
  );

  reg(
    "connect.get_context_for",
    {
      description:
        "Graph traversal from a topic and optional seed claim id. Same structured response as connect.search. BYO Surreal must be configured and reachable.",
      inputSchema: connectGetContextInput,
      outputSchema: connectRetrieveOutput,
    },
    async (args) => {
      const workspaceId = resolveWorkspaceId(args.workspace_id as string | undefined);
      if (!workspaceId) {
        return mcpTextResult({
          ok: false,
          code: "RST_CONNECT_WORKSPACE",
          message: "workspace_id or RESTORMEL_WORKSPACE_ID is required.",
        });
      }
      const body: Record<string, unknown> = {
        workspace_id: workspaceId,
        query: args.topic,
        depth: args.depth,
        max_claims: args.max_claims,
      };
      if (args.seed_claim_id) body.seed_claim_id = args.seed_claim_id;
      const projectId = resolveProjectId(args.project_id as string | undefined);
      if (projectId) body.project_id = projectId;
      const r = await callHostedRetrieve(body);
      return mcpTextResult(r);
    },
  );

  reg(
    "connect.retrieve",
    {
      description:
        "Deprecated alias for connect.search. Prefer connect.search with query + workspace_id. Still accepts legacy requestJson for one release.",
      inputSchema: {
        query: z.string().min(1).optional(),
        requestJson: z.string().optional(),
        workspace_id: z.string().uuid().optional(),
        project_id: z.string().uuid().optional(),
        depth: z.enum(["quick", "standard", "deep"]).optional(),
        max_claims: z.number().int().positive().max(500).optional(),
      },
      outputSchema: connectRetrieveOutput,
    },
    async (args) => {
      if (typeof args.requestJson === "string" && args.requestJson.trim()) {
        const validated = await connectValidateRetrieveRequest(args.requestJson);
        if (!validated.ok) return mcpTextResult(validated);
        const base = process.env.RESTORMEL_CONNECT_API_BASE?.trim();
        const key = process.env.RESTORMEL_GATEWAY_KEY?.trim();
        if (base && key) {
          const parsed = JSON.parse(args.requestJson) as unknown;
          const proxied = await connectProxyPost({
            baseUrl: base,
            gatewayKey: key,
            path: "/connect/v1/retrieve",
            body: parsed,
          });
          if (!proxied.ok) return mcpTextResult(proxied);
          return mcpTextResult({ ...(proxied.json as object), ok: true, upstreamStatus: proxied.status });
        }
      }
      const query = (args.query as string) ?? "";
      if (!query.trim()) {
        return mcpTextResult({
          ok: false,
          code: "RST_CONNECT_ARG",
          message: "Provide query (alias of connect.search) or legacy requestJson.",
        });
      }
      const workspaceId = resolveWorkspaceId(args.workspace_id as string | undefined);
      if (!workspaceId) {
        return mcpTextResult({
          ok: false,
          code: "RST_CONNECT_WORKSPACE",
          message: "workspace_id or RESTORMEL_WORKSPACE_ID is required.",
        });
      }
      const body: Record<string, unknown> = {
        workspace_id: workspaceId,
        query,
        depth: args.depth,
        max_claims: args.max_claims,
      };
      const projectId = resolveProjectId(args.project_id as string | undefined);
      if (projectId) body.project_id = projectId;
      const r = await callHostedRetrieve(body);
      return mcpTextResult(r);
    },
  );
}
