/**
 * EBV verification states (docs/decisions/evidence-bound-verification.md).
 *
 * These replace ok/weak/unsupported as the product-facing truth:
 *   supported    — evidence-bound (Layer 1) AND entailed (Layer 2)
 *   inferred     — entailed but no direct bound span; always labeled as inference
 *   unverified   — judge abstained / no bindable evidence / low confidence → review
 *   contradicted — evidence entails the negation (Layer 2; unused until then)
 *   excluded     — remediation/operator decision (existing reversible soft-exclude)
 *
 * INTERIM (Layer 1 only, until Stage 1.0d lands span-scoped entailment): the legacy
 * validator verdict stands in for Layer 2 entailment. The mapping below is deliberately
 * conservative — a claim whose quote does not bind to its cited source can NEVER be
 * supported, whatever the legacy judge said (this is what closes misattribution).
 */
import type { UnitValidationStatus } from "./validation.js";
import type { EvidenceBinding } from "./evidence-binding.js";
import {
  ENTAILMENT_LOW_CONFIDENCE,
  type EntailmentVerdict,
  type UnitEntailment,
} from "./entailment.js";

export type ClaimVerificationState =
  | "supported"
  | "inferred"
  | "unverified"
  | "contradicted"
  | "excluded";

export type Layer1StateInput = {
  binding: EvidenceBinding;
  /** Legacy validator verdict, standing in for Layer 2 until 1.0d. */
  legacyVerdict: UnitValidationStatus | "omitted";
};

export function deriveLayer1State(input: Layer1StateInput): ClaimVerificationState {
  const bound = input.binding.status === "bound";
  if (input.legacyVerdict === "ok") {
    // The judge affirmed it — but without a bound span in the CITED source it is at
    // best an inference, never "supported".
    return bound ? "supported" : "inferred";
  }
  // weak | unsupported | omitted → reviewable, regardless of binding. ("contradicted"
  // requires Layer 2 negative entailment; the legacy judge's "unsupported" is not that.)
  return "unverified";
}

export type Layer2StateInput = {
  binding: EvidenceBinding;
  verdict: EntailmentVerdict;
  /** Judge confidence 0–1; null = judge omitted it (treated as not-low). */
  confidence: number | null;
};

/**
 * Layer 2 (Stage 1.0d): span-scoped entailment composed with the Layer-1 binding.
 *   entailed + bound          → supported (the ADR's full bar: Layer 1 ∧ Layer 2)
 *   entailed + unbound        → inferred  (always labeled as inference, never supported)
 *   entailed + low confidence → unverified (review — low confidence is never laundered)
 *   not_entailed | abstain    → unverified (review; remediation may later exclude).
 * "contradicted" is reserved for a negative-entailment check this judge does not make.
 */
export function deriveLayer2State(input: Layer2StateInput): ClaimVerificationState {
  if (input.verdict === "entailed") {
    if (input.confidence !== null && input.confidence < ENTAILMENT_LOW_CONFIDENCE) {
      return "unverified";
    }
    return input.binding.status === "bound" ? "supported" : "inferred";
  }
  return "unverified";
}

/**
 * Coarse projection onto the legacy ok/weak/unsupported column (kept for G2 metrics and
 * one release of dashboard compat — verification_state is the product-facing truth).
 * Abstentions project to "weak" for the column ONLY; orchestrators must route abstained
 * claims to review, never into remediation (see ingest-full-runner).
 */
export function entailmentToLegacyStatus(result: UnitEntailment): UnitValidationStatus {
  if (result.verdict === "entailed") {
    return result.confidence !== null && result.confidence < ENTAILMENT_LOW_CONFIDENCE
      ? "weak"
      : "ok";
  }
  return result.verdict === "not_entailed" ? "unsupported" : "weak";
}
