/**
 * connect.graph.expand_context — graph expansion from explicit seed node ids.
 * This is where graph-RAG beats vector-RAG: you already have anchors and want
 * their neighbourhood, optionally filtered by edge type.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { fromUnknown } from "../errors.js";
import {
  mapClaims,
  mapVerificationPolicy,
  mcpResult,
  policyLabel,
  traceSummary,
  verificationPolicySchema,
  workspaceFields,
  type ToolContext,
} from "./_shared.js";

export function registerExpandContext(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "connect.graph.expand_context",
    {
      description:
        "Graph expansion from explicit seed node ids (where graph-RAG beats vector-RAG). Optional edge_types filtering. Returns a context block, provenance-rich claims, and an audit trace. Trust: supported-only by default.",
      inputSchema: {
        seed_node_ids: z.array(z.string().min(1)).min(1).max(50),
        depth: z.number().int().positive().max(8).optional(),
        edge_types: z.array(z.string().min(1)).max(20).optional(),
        max_tokens: z.number().int().positive().max(100_000).optional(),
        verification_policy: verificationPolicySchema,
        ...workspaceFields,
      },
    },
    async (args) => {
      try {
        const policy = mapVerificationPolicy(args.verification_policy, ctx.config.defaultVerification);
        const result = await ctx.orchestrator.expandContext({
          seedNodeIds: args.seed_node_ids,
          depth: args.depth,
          edgeTypeFiltering: args.edge_types,
          maxTokens: args.max_tokens ?? ctx.config.maxTokens,
          verificationPolicy: policy,
        });
        const retrievedAt = new Date().toISOString();
        return mcpResult({
          context_block: result.context_block,
          claims: mapClaims(result, policyLabel(policy), retrievedAt),
          trace_summary: traceSummary(result.trace),
        });
      } catch (err) {
        return mcpResult(fromUnknown(err, "expand_context"));
      }
    },
  );
}
