/**
 * Verifying proxy — Phase A (W2-1) types. (planning/w2-1-phase-a-reference-integration.md,
 * REC-PLAN-009; D-0 accepted, REC-ADR-005.)
 *
 * The verify core is HERMETIC: no MCP SDK, no keys, no network. It turns a Mode-1 upstream
 * answer ({answer, claims, supporting sources}) into a VerifiedEnvelope by reusing the EBV
 * engine (ingest/evidence-binding + ingest/entailment) — span + source_hash + cross-model
 * entailment + abstention — hosting no graph and storing no source bytes (reference-by-hash
 * only; embed-bytes deferred, R5).
 */
import type { EvidenceBinding } from "../ingest/evidence-binding.js";

/**
 * What a Mode-1 (GraphRAG-style) upstream returns: a synthesized answer, optional explicit
 * claims, and the supporting sources it was grounded against. Text-only in v1 (R-nontext:
 * structured/binary upstream payloads are out of scope).
 */
export type Mode1Source = { id: string; text: string; uri?: string };
export type Mode1Result = {
  answer: string;
  /** Explicit decomposed claims when the upstream supplies them; else the answer is one claim. */
  claims?: string[];
  sources: Mode1Source[];
};

/**
 * A claim paired with the sources it may be grounded against, plus any verbatim quotes the
 * upstream already supplied for it (quote-retrieval contract: prefer upstream quotes; else an
 * injected validator retrieves candidate quotes — see extract-claims.ts).
 */
export type ClaimWithSources = {
  claim: string;
  sources: Mode1Source[];
  /** Verbatim supporting quotes the upstream already provided (0 = retrieve via validator). */
  quotes?: string[];
};

/**
 * Status mapping (fail-safe table — load-bearing):
 *   bound + entailed       → "supported"
 *   bound + not_entailed   → "unverified"
 *   ANYTHING else          → "abstain" (→ review)
 *     (unbound / no_evidence / abstain / timeout / validator-unreachable / error / missing verdict)
 * An error, timeout, or missing verdict is NEVER "supported".
 */
export type EnvelopeStatus = "supported" | "unverified" | "abstain";

/** The (known) author of a Mode-1 answer, used for validator-independence (D-c). */
export type AnswerAuthor = { family: string; model?: string } | null;

export type EnvelopeClaim = {
  claim: string;
  status: EnvelopeStatus;
  /** EBV Layer-1 binding: span + source_hash + match, OR unbound / no_evidence. */
  binding: EvidenceBinding;
  /** EBV Layer-2 cross-model entailment verdict (or a local abstain on the fail-safe legs). */
  entailment: {
    verdict: "entailed" | "not_entailed" | "abstain";
    confidence: number | null;
    note?: string;
  };
  /** Reference-by-hash provenance (R5: no embedded source bytes). */
  source_ref: { id: string; uri?: string; source_hash: string };
};

export type EnvelopeMeta = {
  /** Resolved validator model id when known; null for the stub / fail-closed path. */
  validator_model: string | null;
  judged_at: string;
  /** Per-leg latency: callTool, quote retrieval, judgeEntailment, layer-1 bind/hash. */
  legs_ms: Record<string, number>;
  /** Restormel-side validator cost (the proxy's own model spend, not the upstream's). */
  restormel_cost: { calls: number; chars: number };
};

export type VerifiedEnvelope = { claims: EnvelopeClaim[]; meta: EnvelopeMeta };
