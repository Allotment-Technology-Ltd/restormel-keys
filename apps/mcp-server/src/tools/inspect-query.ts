/**
 * connect.graph.inspect_query — THE diagnostic tool. Runs a dry retrieval that
 * separates what WOULD be retrieved under the configured default policy from
 * what EXISTS but is filtered out, and explains why each candidate is dropped.
 *
 * Mechanism: run retrieval once with a permissive policy
 * (include: supported, weak, unsupported) to surface every candidate, then
 * re-apply the configured default policy in-process to partition the candidates.
 * This makes the trust filter legible — an agent (or human) can see exactly what
 * the supported-only default is hiding before deciding whether to widen it.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type {
  RetrievedClaim,
  VerificationCategory,
  VerificationPolicy,
} from "@restormel/graphrag-core";
import { fromUnknown } from "../errors.js";
import {
  mapVerificationPolicy,
  mcpResult,
  policyLabel,
  toClaimWithProvenance,
  traceSummary,
  verificationPolicySchema,
  workspaceFields,
  type ToolContext,
} from "./_shared.js";

const ALL_CATEGORIES: VerificationCategory[] = ["supported", "weak", "unsupported"];

/** Classify a claim into a trust category from its category hint / raw state. */
function categoryOf(claim: RetrievedClaim): VerificationCategory {
  if (claim.verification_category) return claim.verification_category;
  // Fall back conservatively: no category hint → treat as weak.
  return "weak";
}

/** Re-apply the policy in-process to decide if a candidate survives, and why not. */
function evaluate(
  claim: RetrievedClaim,
  policy: VerificationPolicy,
): { admitted: boolean; reason?: string } {
  const category = categoryOf(claim);
  const trust = claim.trust_score ?? null;

  if (category === "unsupported" && policy.excludeFlagged !== false) {
    return { admitted: false, reason: `flagged/unsupported claim excluded (excludeFlagged)` };
  }
  if (!policy.include.includes(category)) {
    return {
      admitted: false,
      reason: `category "${category}" not in policy include=[${policy.include.join(",")}]`,
    };
  }
  if (policy.minTrustScore !== undefined && typeof trust === "number" && trust < policy.minTrustScore) {
    return {
      admitted: false,
      reason: `trust_score ${trust} below minTrustScore ${policy.minTrustScore}`,
    };
  }
  return { admitted: true };
}

export function registerInspectQuery(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "connect.graph.inspect_query",
    {
      description:
        "Diagnostic dry run. Retrieves ALL candidates permissively, then shows what WOULD be returned under the configured default trust policy vs what is FILTERED OUT and why. Use this to understand what supported-only retrieval is hiding before widening the policy.",
      inputSchema: {
        query: z.string().min(1).describe("Natural-language query to inspect."),
        verification_policy: verificationPolicySchema.describe(
          "Policy to inspect against. Defaults to the server's RESTORMEL_DEFAULT_VERIFICATION.",
        ),
        depth: z.number().int().positive().max(8).optional(),
        max_tokens: z.number().int().positive().max(100_000).optional(),
        ...workspaceFields,
      },
    },
    async (args) => {
      try {
        // Permissive retrieval: surface every candidate regardless of trust.
        const permissive: VerificationPolicy = {
          include: ALL_CATEGORIES,
          excludeFlagged: false,
        };
        const result = await ctx.orchestrator.retrieveContext({
          query: args.query,
          maxDepth: args.depth,
          maxTokens: args.max_tokens ?? ctx.config.maxTokens,
          verificationPolicy: permissive,
        });

        // The policy we are inspecting against (configured default unless overridden).
        const policy = mapVerificationPolicy(args.verification_policy, ctx.config.defaultVerification);
        const label = policyLabel(policy);
        const retrievedAt = new Date().toISOString();
        const seeds = new Set(result.subgraph.seed_claim_ids);

        const wouldRetrieve = [];
        const filteredOut = [];
        const reasonFiltered: string[] = [];

        for (const claim of result.subgraph.claims) {
          const hopDepth = seeds.has(claim.id) ? 0 : 1;
          const mapped = toClaimWithProvenance(claim, {
            hopDepth,
            policyApplied: label,
            retrievedAt,
          });
          const verdict = evaluate(claim, policy);
          if (verdict.admitted) {
            wouldRetrieve.push(mapped);
          } else {
            filteredOut.push(mapped);
            reasonFiltered.push(`${claim.id}: ${verdict.reason}`);
          }
        }

        return mcpResult({
          would_retrieve: wouldRetrieve,
          filtered_out: filteredOut,
          reason_filtered: reasonFiltered,
          policy_inspected: label,
          trace: {
            ...traceSummary(result.trace),
            retrieval_trace: result.retrieval_trace,
          },
        });
      } catch (err) {
        return mcpResult(fromUnknown(err, "inspect_query"));
      }
    },
  );
}
