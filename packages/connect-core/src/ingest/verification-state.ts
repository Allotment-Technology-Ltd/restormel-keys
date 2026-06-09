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
