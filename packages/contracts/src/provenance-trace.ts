/**
 * Provenance audit trace (Connect v1).
 *
 * The retrieval orchestrator produces a full audit trace on every query. This module
 * exposes that trace as a structured, versioned JSON document: the canonical record of
 * *why* a given set of claims was (or was not) returned for a query. It is the foundation
 * for the `restormel replay` CLI and future verification certificates.
 *
 * Versioning: `schema_version` is bumped only on breaking shape changes. Additive,
 * backward-compatible fields do not bump it. Consumers MUST tolerate unknown fields.
 */
import { z } from 'zod';

/** Current provenance-trace schema version. Bumped only on breaking changes. */
export const PROVENANCE_TRACE_SCHEMA_VERSION = '1.0' as const;

/** Claim text is truncated to this many characters in trace records (keeps traces compact). */
export const PROVENANCE_TRACE_TEXT_LIMIT = 200;

/** The trust filter that was in force for the query, as applied by the orchestrator. */
export const ProvenanceVerificationPolicySchema = z.object({
  /** Verification states/categories that were eligible for inclusion (e.g. ['supported','weak']). */
  included_states: z.array(z.string()),
  /** Minimum trust score (0–100) a claim needed to be included. 0 when unset. */
  min_trust_score: z.number(),
  /** Whether flagged claims were excluded regardless of category. */
  excluded_flagged: z.boolean()
});
export type ProvenanceVerificationPolicy = z.infer<typeof ProvenanceVerificationPolicySchema>;

/** A seed claim: an entry point into the graph chosen by vector/lexical search or forced by the caller. */
export const SeedRecordSchema = z.object({
  claim_id: z.string(),
  /** Truncated to {@link PROVENANCE_TRACE_TEXT_LIMIT} characters. Empty when not resolvable. */
  claim_text: z.string(),
  source_ref: z.string().nullable(),
  claim_type: z.string().nullable(),
  domain: z.string().nullable(),
  /** Seed selection score (vector/lexical confidence) when the engine supplies one. */
  confidence_score: z.number().nullable()
});
export type SeedRecord = z.infer<typeof SeedRecordSchema>;

/**
 * One graph-expansion band. v1.0 emits a single summarising band per query (the engine does
 * not yet expose per-hop deltas); `depth` is the maximum traversal depth reached.
 */
export const ExpansionHopSchema = z.object({
  depth: z.number().int().nonnegative(),
  /** Claims reached by traversal (beyond the seed set). */
  claims_traversed: z.number().int().nonnegative(),
  /** Relations kept after pruning. */
  relations_traversed: z.number().int().nonnegative(),
  /** Edge types that participated in traversal. */
  edge_types: z.array(z.string())
});
export type ExpansionHop = z.infer<typeof ExpansionHopSchema>;

/** Per-claim verdict: every claim the orchestrator considered, included or not, with the reason. */
export const ClaimTraceSchema = z.object({
  claim_id: z.string(),
  /** Truncated to {@link PROVENANCE_TRACE_TEXT_LIMIT} characters. */
  claim_text: z.string(),
  source_ref: z.string().nullable(),
  verification_state: z.string().nullable(),
  trust_score: z.number().nullable(),
  confidence_score: z.number().nullable(),
  /** True when the claim appears in the returned context; false when filtered out. */
  included: z.boolean(),
  /** Why an excluded claim was dropped (verification gate, confidence gate, duplicate, …). */
  exclusion_reason: z.string().optional(),
  /** 0 for seed claims, ≥1 for claims reached by traversal. */
  hop_depth: z.number().int().nonnegative(),
  /** Edge types on the path from a seed to this claim (best-effort within the returned subgraph). */
  edge_path: z.array(z.string())
});
export type ClaimTrace = z.infer<typeof ClaimTraceSchema>;

export const ProvenanceTraceResultSchema = z.object({
  claims_retrieved: z.number().int().nonnegative(),
  claims_filtered: z.number().int().nonnegative(),
  tokens_used: z.number().int().nonnegative(),
  token_budget: z.number().int().nonnegative(),
  truncated: z.boolean()
});
export type ProvenanceTraceResult = z.infer<typeof ProvenanceTraceResultSchema>;

export const ProvenanceTraceTimingSchema = z.object({
  /** Sub-phase timings are reserved in v1.0 (engine instrumentation pending) and may be 0. */
  seed_ms: z.number().nonnegative(),
  expansion_ms: z.number().nonnegative(),
  ranking_ms: z.number().nonnegative(),
  /** Measured wall-clock duration of the orchestrator call. */
  total_ms: z.number().nonnegative()
});
export type ProvenanceTraceTiming = z.infer<typeof ProvenanceTraceTimingSchema>;

export const ProvenanceTraceSchema = z.object({
  schema_version: z.literal(PROVENANCE_TRACE_SCHEMA_VERSION),
  trace_id: z.string(),
  query: z.string(),
  workspace_id: z.string(),
  domain_pack: z.string(),
  graph_store_type: z.string(),
  /** ISO 8601 timestamp of when the query ran. */
  queried_at: z.string(),
  verification_policy: ProvenanceVerificationPolicySchema,
  seeds: z.array(SeedRecordSchema),
  expansion: z.array(ExpansionHopSchema),
  result: ProvenanceTraceResultSchema,
  claims: z.array(ClaimTraceSchema),
  timing: ProvenanceTraceTimingSchema
});
export type ProvenanceTrace = z.infer<typeof ProvenanceTraceSchema>;

/** Truncate claim text for compact trace storage (single source of truth for the 200-char rule). */
export function truncateClaimText(text: string, limit: number = PROVENANCE_TRACE_TEXT_LIMIT): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit);
}
