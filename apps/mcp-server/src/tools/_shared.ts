/**
 * _shared — types and helpers reused by every tool: the ClaimWithProvenance
 * shape, the verification-policy input schema, mapping from the orchestrator's
 * result into provenance-rich claims, and the MCP result envelope.
 */
import * as z from "zod/v4";
import type {
  OrchestratorResult,
  OrchestratorTrace,
  RetrievalOrchestrator,
  RetrievedClaim,
  VerificationCategory,
  VerificationPolicy,
} from "@restormel/graphrag-core";
import type { ServerConfig } from "../config.js";

/** Everything a tool needs to run: the built orchestrator and the server config. */
export interface ToolContext {
  orchestrator: RetrievalOrchestrator;
  config: ServerConfig;
}

/** A retrieved claim plus the provenance an agent needs to trust or discard it. */
export interface ClaimWithProvenance {
  claimId: string;
  claimText: string;
  sourceRef: string;
  verificationState: string;
  confidenceScore: number;
  trustScore: number;
  retrievedAt: string;
  hopDepth: number;
  policyApplied: string;
  auditTrace: AuditHop[];
}

/** One step of provenance: how/why a claim entered the result set. */
export interface AuditHop {
  step: string;
  detail: string;
}

/** Full traversal trace surfaced by inspect_query. */
export type AuditTrace = OrchestratorTrace & {
  retrieval_trace?: OrchestratorResult["retrieval_trace"];
};

/** Zod schema for the optional per-call verification policy (snake_case wire shape). */
export const verificationPolicySchema = z
  .object({
    include: z.array(z.enum(["supported", "weak", "unsupported"])).min(1),
    min_trust_score: z.number().min(0).max(100).optional(),
    exclude_flagged: z.boolean().optional(),
  })
  .optional()
  .describe(
    "Trust filter. Defaults to the server's RESTORMEL_DEFAULT_VERIFICATION (supported-only). Include 'weak'/'unsupported' to widen.",
  );

export type VerificationPolicyInput = z.infer<typeof verificationPolicySchema>;

/** Workspace/project fields shared across tools (resolved against env when omitted). */
export const workspaceFields = {
  workspace_id: z
    .string()
    .optional()
    .describe("Workspace id. Defaults to RESTORMEL_WORKSPACE_ID when omitted."),
  project_id: z.string().optional().describe("Optional project id for scoping."),
};

/** Translate the wire policy into graphrag-core's VerificationPolicy. */
export function mapVerificationPolicy(
  input: VerificationPolicyInput,
  fallback: VerificationCategory[],
): VerificationPolicy {
  if (!input) {
    return { include: fallback, excludeFlagged: true };
  }
  return {
    include: input.include as VerificationCategory[],
    ...(input.min_trust_score !== undefined ? { minTrustScore: input.min_trust_score } : {}),
    excludeFlagged: input.exclude_flagged ?? true,
  };
}

/** Map one engine claim into a provenance-rich claim for the given policy + trace. */
export function toClaimWithProvenance(
  claim: RetrievedClaim,
  opts: { hopDepth: number; policyApplied: string; retrievedAt: string },
): ClaimWithProvenance {
  return {
    claimId: claim.id,
    claimText: claim.text,
    sourceRef: claim.source_title || "",
    verificationState: claim.verification_state ?? claim.verification_category ?? "unknown",
    confidenceScore: claim.confidence ?? 0,
    trustScore: claim.trust_score ?? 0,
    retrievedAt: opts.retrievedAt,
    hopDepth: opts.hopDepth,
    policyApplied: opts.policyApplied,
    auditTrace: [
      { step: "retrieved", detail: `source: ${claim.source_title || "unknown"}` },
      {
        step: "classified",
        detail: `category: ${claim.verification_category ?? "weak"}, state: ${claim.verification_state ?? "none"}`,
      },
    ],
  };
}

/** Map a whole orchestrator result's claims (best-effort hop depth: 0 for seeds, 1 otherwise). */
export function mapClaims(
  result: OrchestratorResult,
  policyApplied: string,
  retrievedAt: string,
): ClaimWithProvenance[] {
  const seeds = new Set(result.subgraph.seed_claim_ids);
  return result.subgraph.claims.map((claim) =>
    toClaimWithProvenance(claim, {
      hopDepth: seeds.has(claim.id) ? 0 : 1,
      policyApplied,
      retrievedAt,
    }),
  );
}

/** Compact summary of an orchestrator trace for tool output. */
export function traceSummary(trace: OrchestratorTrace): Record<string, unknown> {
  return {
    operation: trace.operation,
    seed_count: trace.seed_count,
    hops: trace.hops,
    claim_count: trace.claim_count,
    relation_count: trace.relation_count,
    tokens_used: trace.tokens_used,
    nodes_dropped: trace.nodes_dropped,
    ...(trace.reasoning_mode ? { reasoning_mode: trace.reasoning_mode } : {}),
    ...(trace.degraded ? { degraded: true, degraded_reason: trace.degraded_reason } : {}),
    ...(trace.verification ? { verification: trace.verification } : {}),
    ...(trace.reason ? { reason: trace.reason } : {}),
  };
}

/** Describe a policy for the policyApplied label. */
export function policyLabel(policy: VerificationPolicy): string {
  const flags = policy.excludeFlagged === false ? "include-flagged" : "exclude-flagged";
  const trust = policy.minTrustScore !== undefined ? `, minTrust=${policy.minTrustScore}` : "";
  return `include=[${policy.include.join(",")}], ${flags}${trust}`;
}

/** Build the MCP tool result envelope (text + structuredContent). */
export function mcpResult(structuredContent: object) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent: structuredContent as { [x: string]: unknown },
  };
}
