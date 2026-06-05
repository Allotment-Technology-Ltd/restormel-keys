/**
 * Connect Knowledge MCP tools — the model-agnostic RetrievalOrchestrator surface.
 *
 * Each tool maps to one orchestrator operation and proxies to the hosted REST endpoint
 * POST /connect/v1/graph (BYO Surreal graph store). Returns curated, ranked, token-budgeted
 * context — never raw rows.
 *
 * TRUST PROMISE: every tool's verification_policy defaults to supported-only; weak/unsupported
 * claims are excluded unless explicitly requested via verification_policy.include.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { connectProxyPost } from "./connect-tools-logic.js";
import type { RestormelSuiteToolName } from "./suite-tool-names.js";

type ToolReg = (
  name: RestormelSuiteToolName,
  config: {
    description: string;
    inputSchema: Record<string, z.ZodType>;
    outputSchema: Record<string, z.ZodType>;
  },
  handler: (
    args: Record<string, unknown>,
  ) => Promise<{ content: { type: "text"; text: string }[]; structuredContent: unknown }>,
) => void;

const verificationPolicy = z
  .object({
    include: z.array(z.enum(["supported", "weak", "unsupported"])).min(1),
    min_trust_score: z.number().min(0).max(100).optional(),
    exclude_flagged: z.boolean().optional(),
  })
  .optional()
  .describe(
    "Trust filter. Defaults to supported-only with flagged excluded. Include 'weak'/'unsupported' to widen.",
  );

const workspaceFields = {
  workspace_id: z
    .string()
    .uuid()
    .optional()
    .describe("Keys workspace id. Defaults to RESTORMEL_WORKSPACE_ID env when omitted."),
  project_id: z.string().uuid().optional().describe("Keys project id when required by your key scope."),
};

const graphOpOutput = {
  ok: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  contract_version: z.string().optional(),
  request_id: z.string().optional(),
  operation: z.string().optional(),
  context_block: z.string().optional(),
  subgraph: z.unknown().optional(),
  paths: z.unknown().optional(),
  trace: z.unknown().optional(),
  metadata: z.unknown().optional(),
  upstreamStatus: z.number().optional(),
};

function resolveWorkspaceId(explicit?: string): string | null {
  const id = explicit?.trim() || process.env.RESTORMEL_WORKSPACE_ID?.trim();
  return id || null;
}

function resolveProjectId(explicit?: string): string | undefined {
  return explicit?.trim() || process.env.RESTORMEL_PROJECT_ID?.trim() || undefined;
}

function mcpTextResult(structuredContent: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

async function callGraphOp(body: Record<string, unknown>) {
  const base = process.env.RESTORMEL_CONNECT_API_BASE?.trim();
  const key = process.env.RESTORMEL_GATEWAY_KEY?.trim();
  if (!base || !key) {
    return {
      ok: false as const,
      code: "RST_CONNECT_HOSTED",
      message:
        "Set RESTORMEL_CONNECT_API_BASE and RESTORMEL_GATEWAY_KEY to call the hosted graph orchestrator.",
    };
  }
  const proxied = await connectProxyPost({
    baseUrl: base,
    gatewayKey: key,
    path: "/connect/v1/graph",
    body,
  });
  if (!proxied.ok) return proxied;
  const upstream = proxied.json as Record<string, unknown>;
  return { ok: true as const, upstreamStatus: proxied.status, ...upstream };
}

/** Build the proxy body, resolving workspace/project from args or env. */
function buildBody(
  operation: string,
  args: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> | { ok: false; code: string; message: string } {
  const workspaceId = resolveWorkspaceId(args.workspace_id as string | undefined);
  if (!workspaceId) {
    return {
      ok: false,
      code: "RST_CONNECT_WORKSPACE",
      message: "workspace_id or RESTORMEL_WORKSPACE_ID is required.",
    };
  }
  const body: Record<string, unknown> = { workspace_id: workspaceId, operation };
  const projectId = resolveProjectId(args.project_id as string | undefined);
  if (projectId) body.project_id = projectId;
  for (const f of fields) {
    if (args[f] !== undefined) body[f] = args[f];
  }
  return body;
}

export function registerConnectKnowledgeTools(_server: McpServer, reg: ToolReg): void {
  reg(
    "connect.graph.retrieve_context",
    {
      description:
        "Primary retrieval: vector-seeded, graph-expanded, token-budgeted context for a query. Returns a curated subgraph + context block + audit trace. Trust: supported-only by default (set verification_policy to include weak/unsupported).",
      inputSchema: {
        query: z.string().min(1).describe("Natural-language query."),
        top_k: z.number().int().positive().max(100).optional(),
        max_depth: z.number().int().positive().max(8).optional(),
        max_tokens: z.number().int().positive().max(100_000).optional(),
        domain: z.string().min(1).optional(),
        verification_policy: verificationPolicy,
        ...workspaceFields,
      },
      outputSchema: graphOpOutput,
    },
    async (args) => {
      const body = buildBody("retrieve_context", args, [
        "query",
        "top_k",
        "max_depth",
        "max_tokens",
        "domain",
        "verification_policy",
      ]);
      if ("ok" in body && body.ok === false) return mcpTextResult(body);
      return mcpTextResult(await callGraphOp(body as Record<string, unknown>));
    },
  );

  reg(
    "connect.graph.expand_context",
    {
      description:
        "Graph expansion from explicit seed node ids (where graph-RAG beats vector-RAG). Optional edge_types filtering. Trust: supported-only by default.",
      inputSchema: {
        seed_node_ids: z.array(z.string().min(1)).min(1).max(50),
        depth: z.number().int().positive().max(8).optional(),
        edge_types: z.array(z.string().min(1)).max(20).optional(),
        max_tokens: z.number().int().positive().max(100_000).optional(),
        verification_policy: verificationPolicy,
        ...workspaceFields,
      },
      outputSchema: graphOpOutput,
    },
    async (args) => {
      const body = buildBody("expand_context", args, [
        "seed_node_ids",
        "depth",
        "edge_types",
        "max_tokens",
        "verification_policy",
      ]);
      if ("ok" in body && body.ok === false) return mcpTextResult(body);
      return mcpTextResult(await callGraphOp(body as Record<string, unknown>));
    },
  );

  reg(
    "connect.graph.find_relevant_subgraph",
    {
      description:
        "Topic-driven subgraph with reasoning_mode = semantic | causal | temporal (causal/temporal re-weight edge priors). Trust: supported-only by default.",
      inputSchema: {
        topic: z.string().min(1),
        reasoning_mode: z.enum(["semantic", "causal", "temporal"]).optional(),
        max_nodes: z.number().int().positive().max(500).optional(),
        max_tokens: z.number().int().positive().max(100_000).optional(),
        verification_policy: verificationPolicy,
        ...workspaceFields,
      },
      outputSchema: graphOpOutput,
    },
    async (args) => {
      const body = buildBody("find_relevant_subgraph", args, [
        "topic",
        "reasoning_mode",
        "max_nodes",
        "max_tokens",
        "verification_policy",
      ]);
      if ("ok" in body && body.ok === false) return mcpTextResult(body);
      return mcpTextResult(await callGraphOp(body as Record<string, unknown>));
    },
  );

  reg(
    "connect.graph.find_paths",
    {
      description:
        "Path reasoning between two graph nodes. Returns ranked paths with the relations along each, or empty with a reason when none exists within max_hops.",
      inputSchema: {
        source_node_id: z.string().min(1),
        target_node_id: z.string().min(1),
        max_hops: z.number().int().positive().max(8).optional(),
        edge_types: z.array(z.string().min(1)).max(20).optional(),
        ...workspaceFields,
      },
      outputSchema: graphOpOutput,
    },
    async (args) => {
      const body = buildBody("find_paths", args, [
        "source_node_id",
        "target_node_id",
        "max_hops",
        "edge_types",
      ]);
      if ("ok" in body && body.ok === false) return mcpTextResult(body);
      return mcpTextResult(await callGraphOp(body as Record<string, unknown>));
    },
  );

  reg(
    "connect.graph.summarise_subgraph",
    {
      description:
        "Retrieve (from query/topic or seed_node_ids) then condense the subgraph under a token budget — dedup + salience prune, preserving seed claims. Trust: supported-only by default.",
      inputSchema: {
        query: z.string().min(1).optional(),
        topic: z.string().min(1).optional(),
        seed_node_ids: z.array(z.string().min(1)).min(1).max(50).optional(),
        top_k: z.number().int().positive().max(100).optional(),
        max_depth: z.number().int().positive().max(8).optional(),
        max_tokens: z.number().int().positive().max(100_000).optional(),
        verification_policy: verificationPolicy,
        ...workspaceFields,
      },
      outputSchema: graphOpOutput,
    },
    async (args) => {
      const body = buildBody("summarise_subgraph", args, [
        "query",
        "topic",
        "seed_node_ids",
        "top_k",
        "max_depth",
        "max_tokens",
        "verification_policy",
      ]);
      if ("ok" in body && body.ok === false) return mcpTextResult(body);
      return mcpTextResult(await callGraphOp(body as Record<string, unknown>));
    },
  );
}
