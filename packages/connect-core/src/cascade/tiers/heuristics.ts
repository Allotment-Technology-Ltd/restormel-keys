/**
 * Shared, model-NEUTRAL lexical heuristics used by more than one fixture-double tier
 * (hhem-prefilter, granite-mid). Kept in a NEUTRAL file — not inside any single adapter —
 * so each adapter file stays independently `git rm`-able (restormel-component-plugpoints
 * removability checks 1 + 2): a per-tier excise of `hhem-prefilter.ts` must not break
 * `granite-mid.ts`'s build, and grepping one adapter's component id must NOT hit a sibling
 * adapter's implementation. These are pure string functions with no model, no network, no
 * vendor types, and no component id — they carry no removability weight of their own.
 *
 * NOTE: these are the DOUBLES' stand-in signals only. A live HHEM/Granite adapter computes
 * its own calibrated entailment probability and does not import from here.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "at", "and", "or", "is", "are", "was", "were",
  "be", "been", "for", "with", "as", "by", "that", "this", "it", "its", "from", "which",
]);

export function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Fraction of the claim's content tokens present in the span. Deterministic; no model, no
 * network. The doubles' stand-in for a calibrated entailment probability.
 */
export function lexicalOverlap(claim: string, span: string): number {
  const claimTokens = contentTokens(claim);
  if (claimTokens.length === 0) return 0;
  const spanSet = new Set(contentTokens(span));
  let present = 0;
  for (const t of claimTokens) if (spanSet.has(t)) present += 1;
  return present / claimTokens.length;
}

export const NEGATION_RE =
  /\b(no|not|never|cannot|without|denies?|denied|false|incorrect|none|neither|nor)\b/i;

/**
 * Polarity-mismatch detector (double-only). A negation in the CLAIM but not the SPAN — or
 * vice versa — over substantially shared content is a contradiction signal, NOT support.
 * This is the classic polarity-flip a naive lexical-overlap score gets wrong (e.g. claim
 * "No serious adverse events were reported" vs span "Three serious adverse events were
 * reported"): high token overlap, opposite meaning. The harness surfaced exactly this leak,
 * so the doubles must not score a polarity mismatch as "supported".
 */
export function polarityMismatch(claim: string, span: string): boolean {
  const overlap = lexicalOverlap(claim, span);
  if (overlap < 0.4) return false;
  const claimNeg = NEGATION_RE.test(claim);
  const spanNeg = NEGATION_RE.test(span);
  return claimNeg !== spanNeg;
}
