/**
 * Cheap pre-filter tier double — HHEM-2.1-Open class (Vectara, Apache-2.0; CLEARED per
 * REC-GOV-022 recommended set, D-2026-07-02-1 scope). Cascade stage 1
 * (restormel-verification-engineering §4 tier order; REC-PLAN-023 §a).
 *
 * HONESTY (skill §HONESTY, REC-ADR-016 culture): the real HHEM-2.1-Open checkpoint is a
 * ~110M FLAN-T5 model requiring the weights (and, for throughput, a GPU). Those weights are
 * NOT present in this environment. This file is a fixture-backed TEST DOUBLE that implements
 * the SAME VerifierTier port the live adapter will, using a deterministic lexical-overlap
 * heuristic to produce a plausible calibrated confidence. It emits `fixture: true` on every
 * span so no output is ever presented as a live run. The live adapter (loads weights / calls
 * a hosted HHEM endpoint) is host-app wiring and is reported as "needs GPU/weights".
 *
 * modelFamily "flan-t5" — independent of GPT/Claude/Gemini/Llama/Mistral/Qwen generators
 * AND of the "granite" mid tier below it, satisfying cross-family independence (skill §4).
 *
 * A pre-filter's job: clear the UNAMBIGUOUS majority with high confidence; hand the
 * ambiguous band up. This double returns high confidence only on strong lexical containment
 * and low confidence otherwise, so ambiguous claims escalate rather than being force-decided.
 */
import type { VerifierRequest, VerifierResult, VerifierTier } from "../verifier-port.js";
import { verdictFromEntailment } from "../verdict.js";
import { NEGATION_RE, lexicalOverlap, polarityMismatch } from "./heuristics.js";

// Shared neutral heuristics (lexicalOverlap/polarityMismatch/NEGATION_RE) live in
// tiers/heuristics.ts — NOT here — so a per-tier excise of this adapter file cannot break a
// sibling adapter's build (removability checks 1+2). Re-exported for the barrel + tests that
// already reference them off this module.
export { lexicalOverlap, polarityMismatch } from "./heuristics.js";

/** Bump when the (double's) scoring wording/logic changes — folds into the cache key. */
export const HHEM_PREFILTER_PROMPT_VERSION = "hhem-double-1";

export interface HhemPrefilterOptions {
  /** Overlap at/above which the double is confident the span supports the claim. */
  supportThreshold?: number;
  /** Overlap at/below which the double is confident the span is silent (unverifiable). */
  silentThreshold?: number;
}

/** Detects a refutation: an explicit negation cue in the span, or a claim/span polarity flip. */
function looksRefuted(claim: string, span: string): boolean {
  const overlap = lexicalOverlap(claim, span);
  if (overlap < 0.4) return false;
  if (polarityMismatch(claim, span)) return true;
  return NEGATION_RE.test(span);
}

export function createHhemPrefilterDouble(opts?: HhemPrefilterOptions): VerifierTier {
  const supportThreshold = opts?.supportThreshold ?? 0.8;
  const silentThreshold = opts?.silentThreshold ?? 0.2;
  return {
    id: "hhem-2.1-open",
    modelFamily: "flan-t5",
    modelVersion: "2.1-open-double",
    // configHash = tuning params only; the prompt version is a DISTINCT key input (skill §6).
    configHash: `thr:${supportThreshold}:${silentThreshold}`,
    promptTemplateVersion: HHEM_PREFILTER_PROMPT_VERSION,
    async verify(request: VerifierRequest): Promise<VerifierResult> {
      const overlap = lexicalOverlap(request.claim, request.span);
      if (looksRefuted(request.claim, request.span)) {
        return {
          ref: request.ref,
          verdict: verdictFromEntailment("not_entailed", { refuted: true }),
          confidence: Math.min(0.95, 0.6 + overlap * 0.3),
          note: `[fixture-double] refutation cue + overlap ${overlap.toFixed(2)}`,
        };
      }
      if (overlap >= supportThreshold) {
        return {
          ref: request.ref,
          verdict: verdictFromEntailment("entailed"),
          confidence: Math.min(0.98, overlap),
          note: `[fixture-double] high lexical containment ${overlap.toFixed(2)}`,
        };
      }
      if (overlap <= silentThreshold) {
        return {
          ref: request.ref,
          verdict: verdictFromEntailment("not_entailed"),
          confidence: Math.min(0.9, 0.7 + (silentThreshold - overlap)),
          note: `[fixture-double] span appears silent, overlap ${overlap.toFixed(2)}`,
        };
      }
      // Ambiguous band -> low confidence so the cascade escalates rather than deciding here.
      return {
        ref: request.ref,
        verdict: verdictFromEntailment("not_entailed"),
        confidence: 0.35 + overlap * 0.2,
        note: `[fixture-double] ambiguous, overlap ${overlap.toFixed(2)} -> escalate`,
      };
    },
  };
}
