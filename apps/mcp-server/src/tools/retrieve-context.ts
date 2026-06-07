/**
 * connect.graph.retrieve_context — primary retrieval. Vector/lexical-seeded,
 * graph-expanded, token-budgeted context for a natural-language query.
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

export function registerRetrieveContext(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "connect.graph.retrieve_context",
    {
      description:
        "Primary retrieval: vector/lexical-seeded, graph-expanded, token-budgeted context for a query. Returns a context block, provenance-rich claims, and an audit trace. Trust: supported-only by default (set verification_policy to widen).",
      inputSchema: {
        query: z.string().min(1).describe("Natural-language query."),
        top_k: z.number().int().positive().max(100).optional(),
        max_depth: z.number().int().positive().max(8).optional(),
        max_tokens: z.number().int().positive().max(100_000).optional(),
        domain: z.string().min(1).optional(),
        verification_policy: verificationPolicySchema,
        ...workspaceFields,
      },
    },
    async (args) => {
      try {
        const policy = mapVerificationPolicy(args.verification_policy, ctx.config.defaultVerification);
        const result = await ctx.orchestrator.retrieveContext({
          query: args.query,
          topK: args.top_k,
          maxDepth: args.max_depth,
          maxTokens: args.max_tokens ?? ctx.config.maxTokens,
          domain: args.domain,
          verificationPolicy: policy,
        });
        const retrievedAt = new Date().toISOString();
        return mcpResult({
          context_block: result.context_block,
          claims: mapClaims(result, policyLabel(policy), retrievedAt),
          trace_summary: traceSummary(result.trace),
        });
      } catch (err) {
        return mcpResult(fromUnknown(err, "retrieve_context"));
      }
    },
  );
}
