/**
 * Horizon Phase 1 suite MCP tools (Theme L + cross-product read helpers).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { CANONICAL_DOC_TOPICS } from "./canonical-docs.js";
import {
  suiteMemoryPreview,
  suiteResolveCanonical,
  suiteSummarizeTrace,
  suiteValidateGraphFixture,
  suiteValidateTestingConfig,
} from "./suite-tools-logic.js";
import {
  connectIngestStatusHint,
  connectValidateIngestStartRequest,
  connectValidateVerifyRequest,
  connectProxyPost,
} from "./connect-tools-logic.js";
import { registerConnectAgentTools } from "./connect-agent-tools.js";
import { ROUTING_CAPABILITIES } from "./routing-capabilities.js";
import {
  getEnabledSuiteToolNames,
  type RestormelSuiteToolName,
  type SuiteToolModuleFlags,
} from "./suite-tool-names.js";
import { resolveMcpModuleFlagsFromEnv } from "./module-flags-env.js";

const canonicalResolveInput = {
  topic: z
    .string()
    .describe(`Canonical doc topic id. One of: ${CANONICAL_DOC_TOPICS.join(", ")}.`),
};

const canonicalResolveOutput = {
  ok: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  topic: z.string().optional(),
  title: z.string().optional(),
  repoPath: z.string().optional(),
  publicUrl: z.string().optional(),
};

const testingConfigValidateInput = {
  content: z.string().describe("YAML or JSON string of restormel-testing workspace config."),
  format: z.enum(["yaml", "json"]).describe("Whether content is YAML or JSON."),
};

const testingConfigValidateOutput = {
  ok: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  valid: z.boolean().optional(),
  errors: z
    .array(z.object({ path: z.string(), code: z.string(), message: z.string() }))
    .optional(),
};

const traceSummarizeInput = {
  traceJson: z.string().describe("JSON string of a RunTrace (see @restormel/contracts RunTraceSchema)."),
};

const traceSummarizeOutput = {
  ok: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  summary: z.string().optional(),
  traceId: z.string().optional(),
  eventCount: z.number().optional(),
  spanCount: z.number().optional(),
  errorEventCount: z.number().optional(),
};

const graphFixtureInput = {
  graphJson: z.string().describe("JSON string of GraphData: nodes, edges, ghostNodes, ghostEdges arrays."),
};

const graphFixtureOutput = {
  ok: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  nodeCount: z.number().optional(),
  edgeCount: z.number().optional(),
  ghostNodeCount: z.number().optional(),
  ghostEdgeCount: z.number().optional(),
};

const memoryPreviewInput = {
  eventsJson: z.string().describe("JSON array of Restormel State StateEvent objects."),
  maxCellsPerScope: z.number().int().positive().optional(),
  maxApproxTokensPerScope: z.number().int().positive().optional(),
};

const memoryPreviewOutput = {
  ok: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  last_sequence: z.number().optional(),
  applied_event_count: z.number().optional(),
  scope_ids: z.array(z.string()).optional(),
  scope_cell_counts: z.record(z.string(), z.number()).optional(),
  cells_preview: z
    .array(
      z.object({
        scope: z.string(),
        id: z.string(),
        approx_tokens: z.number(),
        pinned: z.boolean(),
        textLength: z.number(),
      }),
    )
    .optional(),
};

export function registerHorizonSuiteTools(server: McpServer, flags?: SuiteToolModuleFlags): void {
  const resolved = flags ?? resolveMcpModuleFlagsFromEnv();
  const enabledNames = new Set(getEnabledSuiteToolNames(resolved));
  const reg = (
    name: RestormelSuiteToolName,
    definition: Record<string, unknown>,
    handler: (...args: never[]) => unknown,
  ) => {
    if (!enabledNames.has(name)) return;
    server.registerTool(name, definition as never, handler as never);
  };

  const routingCapabilitiesOutput = {
    ok: z.boolean(),
    capabilities: z.any(),
  };

  reg(
    "routing.capabilities",
    {
      description:
        "Return a structured summary of Restormel Keys routing features (resolve, simulate, MCP tool names, AAIF note). Read-only; no network. Use so agents know what is possible before calling the control plane.",
      inputSchema: { _noop: z.boolean().optional().describe("Ignored; callers may send an empty object.") },
      outputSchema: routingCapabilitiesOutput,
    },
    async () => {
      const structuredContent = { ok: true as const, capabilities: ROUTING_CAPABILITIES };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  reg(
    "docs.canonical_resolve",
    {
      description:
        "Resolve a canonical programme doc topic to repo path and optional public URL. Use before citing files in agent output. Read-only; no network.",
      inputSchema: canonicalResolveInput,
      outputSchema: canonicalResolveOutput,
    },
    async (args: { topic: string }) => {
      const r = suiteResolveCanonical(args.topic);
      if (!r.ok) {
        const structuredContent = { ok: false, code: r.code, message: r.message };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
        };
      }
      const structuredContent = {
        ok: true,
        topic: r.entry.topic,
        title: r.entry.title,
        repoPath: r.entry.repoPath,
        publicUrl: r.entry.publicUrl,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  reg(
    "testing.config_validate",
    {
      description:
        "Validate restormel-testing YAML/JSON config offline (schema + MVP rules). Input is string only—do not log secrets. Max ~512k chars.",
      inputSchema: testingConfigValidateInput,
      outputSchema: testingConfigValidateOutput,
    },
    async (args: { content: string; format: "yaml" | "json" }) => {
      const r = suiteValidateTestingConfig(args.content, args.format);
      if (!r.ok) {
        const structuredContent = { ok: false, code: r.code, message: r.message };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
        };
      }
      const structuredContent = r.valid
        ? { ok: true, valid: true }
        : { ok: true, valid: false, errors: r.errors };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  reg(
    "observability.trace_summarize",
    {
      description:
        "Parse a RunTrace JSON string, normalize via @restormel/observability, return compact summary and event/span counts. Read-only; max ~2M chars.",
      inputSchema: traceSummarizeInput,
      outputSchema: traceSummarizeOutput,
    },
    async (args: { traceJson: string }) => {
      const r = suiteSummarizeTrace(args.traceJson);
      if (!r.ok) {
        const structuredContent = { ok: false, code: r.code, message: r.message };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
        };
      }
      const structuredContent = {
        ok: true,
        summary: r.summary,
        traceId: r.traceId,
        eventCount: r.eventCount,
        spanCount: r.spanCount,
        errorEventCount: r.errorEventCount,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  reg(
    "graph.fixture_validate",
    {
      description:
        "Validate minimal GraphData JSON (Contract v0): requires arrays nodes, edges, ghostNodes, ghostEdges. Read-only structural check.",
      inputSchema: graphFixtureInput,
      outputSchema: graphFixtureOutput,
    },
    async (args: { graphJson: string }) => {
      const r = suiteValidateGraphFixture(args.graphJson);
      if (!r.ok) {
        const structuredContent = { ok: false, code: r.code, message: r.message };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
        };
      }
      const structuredContent = {
        ok: true,
        nodeCount: r.nodeCount,
        edgeCount: r.edgeCount,
        ghostNodeCount: r.ghostNodeCount,
        ghostEdgeCount: r.ghostEdgeCount,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  reg(
    "state.memory_preview",
    {
      description:
        "Project Restormel State events into working memory; returns counts and per-cell metadata with text lengths only (no cell body text). Read-only.",
      inputSchema: memoryPreviewInput,
      outputSchema: memoryPreviewOutput,
    },
    async (args: { eventsJson: string; maxCellsPerScope?: number; maxApproxTokensPerScope?: number }) => {
      const r = suiteMemoryPreview(args.eventsJson, {
        maxCellsPerScope: args.maxCellsPerScope,
        maxApproxTokensPerScope: args.maxApproxTokensPerScope,
      });
      if (!r.ok) {
        const structuredContent = { ok: false, code: r.code, message: r.message };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
        };
      }
      const structuredContent = {
        ok: true,
        last_sequence: r.last_sequence,
        applied_event_count: r.applied_event_count,
        scope_ids: r.scope_ids,
        scope_cell_counts: r.scope_cell_counts,
        cells_preview: r.cells_preview,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  const connectRequestJsonInput = {
    requestJson: z.string().describe("JSON body matching @restormel/contracts/connect request schema."),
  };

  const connectValidatedOutput = {
    ok: z.boolean(),
    code: z.string().optional(),
    message: z.string().optional(),
    validated: z.boolean().optional(),
    stage: z.string().optional(),
    note: z.string().optional(),
    upstreamStatus: z.number().optional(),
    upstream: z.unknown().optional(),
  };

  reg(
    "connect.verify",
    {
      description:
        "Validate a Knowledge Verify REST payload (POST /connect/v1/verify). When RESTORMEL_CONNECT_API_BASE and RESTORMEL_GATEWAY_KEY are set, proxies to hosted REST.",
      inputSchema: connectRequestJsonInput,
      outputSchema: connectValidatedOutput,
    },
    async (args: { requestJson: string }) => {
      const base = process.env.RESTORMEL_CONNECT_API_BASE?.trim();
      const key = process.env.RESTORMEL_GATEWAY_KEY?.trim();
      if (base && key) {
        let body: unknown;
        try {
          body = JSON.parse(args.requestJson) as unknown;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const structuredContent = { ok: false, code: "RST_CONNECT_JSON", message: msg };
          return { content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }], structuredContent };
        }
        const proxied = await connectProxyPost({ baseUrl: base, gatewayKey: key, path: "/connect/v1/verify", body });
        if (!proxied.ok) {
          const structuredContent = proxied;
          return { content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }], structuredContent };
        }
        const structuredContent = { ok: true, validated: true, upstreamStatus: proxied.status, upstream: proxied.json };
        return { content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }], structuredContent };
      }
      const r = await connectValidateVerifyRequest(args.requestJson);
      const structuredContent = r.ok
        ? { ...r, note: "Set RESTORMEL_CONNECT_API_BASE + RESTORMEL_GATEWAY_KEY to execute against hosted REST." }
        : r;
      return { content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }], structuredContent };
    },
  );

  registerConnectAgentTools(server, reg);

  reg(
    "connect.ingest.start",
    {
      description:
        "Validate a Knowledge Ingest job create payload (POST /connect/v1/ingest/jobs). Act tier — returns 501 upstream until Phase 5b persistence.",
      inputSchema: connectRequestJsonInput,
      outputSchema: connectValidatedOutput,
    },
    async (args: { requestJson: string }) => {
      const r = await connectValidateIngestStartRequest(args.requestJson);
      const structuredContent = r;
      return { content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }], structuredContent };
    },
  );

  reg(
    "connect.ingest.status",
    {
      description: "Validate job id for Knowledge Ingest status (GET /connect/v1/ingest/jobs/{jobId}). Read tier.",
      inputSchema: { jobId: z.string().describe("Ingest job UUID.") },
      outputSchema: connectValidatedOutput,
    },
    async (args: { jobId: string }) => {
      const r = connectIngestStatusHint(args.jobId);
      const structuredContent = r;
      return { content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }], structuredContent };
    },
  );
}
