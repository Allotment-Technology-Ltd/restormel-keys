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
import { ROUTING_CAPABILITIES } from "./routing-capabilities.js";

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

export function registerHorizonSuiteTools(server: McpServer): void {
  const routingCapabilitiesOutput = {
    ok: z.boolean(),
    capabilities: z.any(),
  };

  server.registerTool(
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

  server.registerTool(
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

  server.registerTool(
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

  server.registerTool(
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

  server.registerTool(
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

  server.registerTool(
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
}
