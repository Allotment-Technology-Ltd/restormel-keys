/**
 * connect.graph.find_relevant_subgraph — topic-driven subgraph. reasoning_mode
 * = semantic | causal | temporal re-weights edge priors toward the matching
 * reasoning class.
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

export function registerFindRelevantSubgraph(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "connect.graph.find_relevant_subgraph",
    {
      description:
        "Topic-driven subgraph with reasoning_mode = semantic | causal | temporal (causal/temporal re-weight edge priors). Returns a context block, provenance-rich claims, and an audit trace. Trust: supported-only by default.",
      inputSchema: {
        topic: z.string().min(1),
        reasoning_mode: z.enum(["semantic", "causal", "temporal"]).optional(),
        max_nodes: z.number().int().positive().max(500).optional(),
        max_tokens: z.number().int().positive().max(100_000).optional(),
        verification_policy: verificationPolicySchema,
        ...workspaceFields,
      },
    },
    async (args) => {
      try {
        const policy = mapVerificationPolicy(args.verification_policy, ctx.config.defaultVerification);
        const result = await ctx.orchestrator.findRelevantSubgraph({
          topic: args.topic,
          reasoningMode: args.reasoning_mode,
          maxNodes: args.max_nodes,
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
        return mcpResult(fromUnknown(err, "find_relevant_subgraph"));
      }
    },
  );
}
