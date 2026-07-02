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

/** Bump when the (double's) scoring wording/logic changes — folds into the cache key. */
export const HHEM_PREFILTER_PROMPT_VERSION = "hhem-double-1";

export interface HhemPrefilterOptions {
  /** Overlap at/above which the double is confident the span supports the claim. */
  supportThreshold?: number;
  /** Overlap at/below which the double is confident the span is silent (unverifiable). */
  silentThreshold?: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "at", "and", "or", "is", "are", "was", "were",
  "be", "been", "for", "with", "as", "by", "that", "this", "it", "its", "from", "which",
]);

function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Fraction of the claim's content tokens present in the span. Deterministic; no model, no
 * network. This is the double's stand-in for a calibrated entailment probability.
 */
export function lexicalOverlap(claim: string, span: string): number {
  const claimTokens = contentTokens(claim);
  if (claimTokens.length === 0) return 0;
  const spanSet = new Set(contentTokens(span));
  let present = 0;
  for (const t of claimTokens) if (spanSet.has(t)) present += 1;
  return present / claimTokens.length;
}

const NEGATION_RE = /\b(no|not|never|cannot|without|denies?|denied|false|incorrect|none|neither|nor)\b/i;

/**
 * Polarity-mismatch detector (double-only). A negation in the CLAIM but not the SPAN — or
 * vice versa — over substantially shared content is a contradiction signal, NOT support.
 * This is the classic polarity-flip a naive lexical-overlap score gets wrong (e.g. claim
 * "No serious adverse events were reported" vs span "Three serious adverse events were
 * reported"): high token overlap, opposite meaning. The harness surfaced exactly this leak,
 * so the double must not score a polarity mismatch as "supported".
 */
export function polarityMismatch(claim: string, span: string): boolean {
  const overlap = lexicalOverlap(claim, span);
  if (overlap < 0.4) return false;
  const claimNeg = NEGATION_RE.test(claim);
  const spanNeg = NEGATION_RE.test(span);
  return claimNeg !== spanNeg;
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
    configHash: `${HHEM_PREFILTER_PROMPT_VERSION}:${supportThreshold}:${silentThreshold}`,
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
