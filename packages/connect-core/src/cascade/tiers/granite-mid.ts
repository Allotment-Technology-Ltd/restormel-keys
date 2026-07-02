/**
 * Mid-tier independent checker double — IBM Granite Guardian 3.3 8B class (Apache-2.0;
 * CLEARED per REC-GOV-022 recommended set, D-2026-07-02-1 scope). Cascade stage 2
 * (restormel-verification-engineering §4; REC-PLAN-023 §a — the recommended primary checker).
 *
 * HONESTY (skill §HONESTY): the real Granite Guardian 3.3 8B needs the weights and a
 * ~16-20GB GPU. Not present here. This is a fixture-backed TEST DOUBLE against the SAME
 * VerifierTier port; the live adapter (self-hosted Granite endpoint via the host app) is
 * reported as "needs GPU/weights". Every span is `fixture: true`.
 *
 * modelFamily "granite" — a DIFFERENT family from the "flan-t5" pre-filter beneath it and
 * from the "frontier-api" tier above it, so adjacent tiers stay decorrelated (skill §4
 * cross-model independence; same-family escalation is decorrelation theatre).
 *
 * The double simulates a stronger checker: it uses a richer lexical + phrase-level signal
 * than the pre-filter, so it can decide part of the band the pre-filter escalated, while
 * still handing the genuinely hard residual to the frontier tier.
 */
import type { VerifierRequest, VerifierResult, VerifierTier } from "../verifier-port.js";
import { verdictFromEntailment } from "../verdict.js";
// Import the shared signals from the NEUTRAL heuristics module, never from the sibling
// hhem-prefilter adapter — so this file and hhem-prefilter.ts are each independently
// removable (removability checks 1+2; the runbook promises per-tier excise leaves the rest
// building green).
import { lexicalOverlap, polarityMismatch } from "./heuristics.js";

export const GRANITE_MID_PROMPT_VERSION = "granite-double-1";

/** Longest contiguous shared word-run between claim and span (phrase-level signal). */
function longestSharedRun(claim: string, span: string): number {
  const c = claim.toLowerCase().split(/\s+/).filter(Boolean);
  const s = span.toLowerCase();
  let best = 0;
  for (let i = 0; i < c.length; i++) {
    for (let len = c.length - i; len > 0; len--) {
      const phrase = c.slice(i, i + len).join(" ");
      if (phrase.length > 2 && s.includes(phrase)) {
        best = Math.max(best, len);
        break;
      }
    }
  }
  return best;
}

export function createGraniteMidDouble(): VerifierTier {
  return {
    id: "granite-guardian-3.3-8b",
    modelFamily: "granite",
    modelVersion: "3.3-8b-double",
    // Double carries no tunable config; the prompt version is the DISTINCT key input (skill §6).
    configHash: "double",
    promptTemplateVersion: GRANITE_MID_PROMPT_VERSION,
    async verify(request: VerifierRequest): Promise<VerifierResult> {
      const overlap = lexicalOverlap(request.claim, request.span);
      const run = longestSharedRun(request.claim, request.span);
      const claimWords = request.claim.split(/\s+/).filter(Boolean).length || 1;
      const phraseSignal = Math.min(1, run / Math.max(3, claimWords * 0.5));
      // Blend token overlap with the phrase signal — a "stronger" checker than the pre-filter.
      const score = 0.6 * overlap + 0.4 * phraseSignal;

      // Refutation: explicit span negation OR a claim/span polarity flip over shared content.
      const spanNegation =
        /\b(no|not|never|cannot|contradicts?|refutes?|false)\b/i.test(request.span) && overlap >= 0.5;
      if (spanNegation || polarityMismatch(request.claim, request.span)) {
        return {
          ref: request.ref,
          verdict: verdictFromEntailment("not_entailed", { refuted: true }),
          confidence: Math.min(0.9, 0.65 + score * 0.25),
          note: `[fixture-double] refutation/polarity-mismatch, score ${score.toFixed(2)}`,
        };
      }
      if (score >= 0.6) {
        return {
          ref: request.ref,
          verdict: verdictFromEntailment("entailed"),
          confidence: Math.min(0.95, 0.55 + score * 0.4),
          note: `[fixture-double] supported, blended score ${score.toFixed(2)}`,
        };
      }
      if (score <= 0.25) {
        return {
          ref: request.ref,
          verdict: verdictFromEntailment("not_entailed"),
          confidence: Math.min(0.9, 0.6 + (0.25 - score)),
          note: `[fixture-double] span silent, blended score ${score.toFixed(2)}`,
        };
      }
      // Hard residual -> low confidence -> cascade escalates to the frontier tier.
      return {
        ref: request.ref,
        verdict: verdictFromEntailment("not_entailed"),
        confidence: 0.4 + score * 0.15,
        note: `[fixture-double] hard residual, score ${score.toFixed(2)} -> escalate`,
      };
    },
  };
}
