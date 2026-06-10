/**
 * Verified-claim response envelope (Connect v1).
 *
 * Stage 1.1 of the verified-context roadmap: every Connect retrieval/read response can
 * carry, per returned claim, the full verification chain defined by the Evidence-Bound
 * Verification ADR (docs/decisions/evidence-bound-verification.md):
 *
 *   claim → state → evidence spans (quote + offsets + source hash) → judge → citation
 *        → provenance trace link → trust score
 *
 * The falsifiability test (ADR §6): a skeptical consumer can take `evidence[].quote` +
 * `offsets` + `source_hash`, fetch the cited source version, and check the quote
 * themselves — no trust in the pipeline required. A surface that cannot render this
 * chain must not say "verified".
 *
 * These schemas are additive projections of data the pipeline already persists:
 *   - states      → `verification_state` written by both graph writers (EBV Layers 1+2)
 *   - evidence    → `evidence_*` unit fields (Surreal BYO) / `connect_claim_versions` (Postgres)
 *   - judge       → `connect_claim_judgment` append-only audit rows (EBV Layer 2)
 *   - trace_ref   → the provenance trace surfaced at GET /connect/v1/traces/{trace_id}
 *
 * Versioning: additive, backward-compatible fields only; the carrying response's
 * `contract_version` governs breaking changes. Consumers MUST tolerate unknown fields.
 */
import { z } from 'zod';

/**
 * EBV verification states — the product-facing truth (replaces ok/weak/unsupported):
 *   supported    — evidence-bound (Layer 1 deterministic span check) AND entailed (Layer 2)
 *   inferred     — entailed but no directly bound span; always labeled as inference
 *   unverified   — judge abstained, low confidence, or no bindable evidence → review queue
 *   contradicted — evidence entails the negation → review; excluded from strict retrieval
 *   excluded     — remediation/operator decision (reversible soft-exclude)
 */
export const VERIFIED_CLAIM_STATES = [
  'supported',
  'inferred',
  'unverified',
  'contradicted',
  'excluded'
] as const;

export const VerifiedClaimStateSchema = z.enum(VERIFIED_CLAIM_STATES);
export type VerifiedClaimState = z.infer<typeof VerifiedClaimStateSchema>;

/**
 * One bound evidence span: the quote, its character offsets in the ORIGINAL source
 * version text, the cited source record, and the content hash of the source version the
 * span was bound against. Deterministically re-checkable at any time without a model
 * (EBV Layer 1) — a hash mismatch or moved quote means verification has rotted, and the
 * claim can no longer be served as supported.
 */
export const VerifiedClaimEvidenceSchema = z.object({
  /** The evidence quote, verbatim as bound at extraction time. */
  quote: z.string(),
  /** `[start, end)` character offsets into the ORIGINAL source version text. */
  offsets: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  /** Graph record reference of the CITED source (e.g. `source:abc123`). */
  source_ref: z.string().nullable(),
  /** SHA-256 (hex) of the source version the span was bound against. */
  source_hash: z.string().nullable(),
  /**
   * How strictly the quote matched its source: exact, normalized (whitespace/unicode
   * folding), or bounded fuzzy. Anything looser than exact is labeled, never hidden.
   */
  match: z.enum(['exact', 'normalized', 'fuzzy']).nullable().optional()
});
export type VerifiedClaimEvidence = z.infer<typeof VerifiedClaimEvidenceSchema>;

/**
 * Attribution of the most recent span-scoped entailment verdict (EBV Layer 2). Every
 * verdict is recorded append-only with model id, prompt version, and timestamp, so it is
 * attributable and re-runnable; this surfaces the latest one.
 */
export const VerifiedClaimJudgeSchema = z.object({
  /** Judge model identifier when known (route-resolved); null otherwise. */
  model: z.string().nullable(),
  /** Entailment prompt version the verdict was produced under. */
  prompt_version: z.number().int().positive(),
  /** Judge-reported confidence 0–1; null when the judge omitted it. */
  confidence: z.number().min(0).max(1).nullable(),
  /** ISO 8601 timestamp the claim was judged. */
  at: z.string()
});
export type VerifiedClaimJudge = z.infer<typeof VerifiedClaimJudgeSchema>;

/**
 * The verified-claim envelope: one per returned unit on Connect v1 retrieval responses.
 * Unverified or excluded units are flagged by `state` — never silently blended.
 */
export const VerifiedClaimEnvelopeSchema = z.object({
  /** The claim as served (graph record id + text). */
  claim: z.object({
    id: z.string(),
    text: z.string()
  }),
  /** EBV verification state. Only `supported` claims carry a fully verified chain. */
  state: VerifiedClaimStateSchema,
  /**
   * Bound evidence spans (0–n). Empty when no evidence could be bound (the claim is then
   * at best `inferred`, never `supported`) or when the graph store omits the EBV fields.
   */
  evidence: z.array(VerifiedClaimEvidenceSchema),
  /** Latest entailment judgment, when the claim has been judged (EBV Layer 2). */
  judge: VerifiedClaimJudgeSchema.optional(),
  /** Human-readable source citation (the cited source's title). */
  citation: z.string().nullable(),
  /**
   * Provenance trace link for the query that returned this claim — fetch the full audit
   * document at this path (`/connect/v1/traces/{trace_id}`). Null when trace persistence
   * was unavailable for the query.
   */
  trace_ref: z.string().nullable(),
  /** Graph trust score 0–100 for this claim, when the graph supplies one. */
  trust_score: z.number().nullable().optional()
});
export type VerifiedClaimEnvelope = z.infer<typeof VerifiedClaimEnvelopeSchema>;

/**
 * Per-state counts for a response's returned units. Lets a consumer gate ("anything
 * non-supported in this context?") without scanning every envelope.
 */
export const VerifiedClaimSummarySchema = z.partialRecord(
  VerifiedClaimStateSchema,
  z.number().int().nonnegative()
);
export type VerifiedClaimSummary = z.infer<typeof VerifiedClaimSummarySchema>;
