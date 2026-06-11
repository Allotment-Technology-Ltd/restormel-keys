/**
 * EBV Layer 1 — deterministic evidence binding and re-verification.
 * (docs/decisions/evidence-bound-verification.md, approved 2026-06-09)
 *
 * Every claim must be bindable to a quoted evidence span: exact quote + character
 * offsets into the cited source version + the source version's content hash. Binding
 * and re-verification are deterministic — anyone can re-run them with no model — which
 * is what makes "supported" falsifiable and tamper-evident:
 *   - a claim whose quote cannot be located in its CITED source can never be supported
 *     (this structurally catches misattribution);
 *   - a span re-check fails if the source content changed (hash mismatch) or the quote
 *     no longer sits at its offsets, so verification cannot silently rot.
 *
 * Matching is layered and recorded: exact → normalized (whitespace runs, unicode
 * quotes/dashes folded, case-insensitive; offsets always refer to the ORIGINAL text) →
 * bounded fuzzy (sentence-window token overlap). Anything looser than exact is labeled,
 * never hidden.
 *
 * No node:crypto — hashing uses Web Crypto (globalThis.crypto.subtle), safe if this
 * module is barrel-imported on a client.
 */
import type { ExtractedUnit } from "./extract.js";

export type EvidenceMatchKind = "exact" | "normalized" | "fuzzy";

export type EvidenceSpan = {
  /** The quote as the extractor returned it (verbatim from the model). */
  quote: string;
  /** Character offsets into the ORIGINAL source text: [start, end). */
  start: number;
  end: number;
  /** SHA-256 (hex) of the source version the span was bound against. */
  source_hash: string;
  match: EvidenceMatchKind;
};

export type EvidenceBinding =
  | { status: "bound"; span: EvidenceSpan }
  | { status: "unbound"; reason: "quote_not_found" }
  | { status: "no_evidence"; reason: "extractor_returned_no_quote" };

/** SHA-256 hex of a source version's text. */
export async function contentHash(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const QUOTE_FOLD: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  " ": " ",
};

/**
 * Normalize text for matching while keeping a map back to original indices.
 * Returns the normalized string and, per normalized char, the index of the original
 * char it came from.
 */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  let lastWasSpace = true; // leading whitespace collapses away
  for (let i = 0; i < text.length; i++) {
    let ch = text[i];
    ch = QUOTE_FOLD[ch] ?? ch;
    if (/\s/.test(ch)) {
      if (lastWasSpace) continue;
      out.push(" ");
      map.push(i);
      lastWasSpace = true;
      continue;
    }
    out.push(ch.toLowerCase());
    map.push(i);
    lastWasSpace = false;
  }
  while (out.length > 0 && out[out.length - 1] === " ") {
    out.pop();
    map.pop();
  }
  return { norm: out.join(""), map };
}

/**
 * The binder's normalization as a plain string (whitespace runs collapsed, unicode
 * quotes/dashes folded, lowercased). Claim identity (Stage 3.2) hashes THIS form so the
 * same evidence quote keeps the same claim_key across re-extractions with minor
 * whitespace/quote drift — exactly the folding used for normalized span matching.
 */
export function normalizeForMatch(text: string): string {
  return normalizeWithMap(text).norm;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/** Sentence-ish windows with original offsets, for the bounded fuzzy fallback. */
function sentenceWindows(text: string): { start: number; end: number }[] {
  const windows: { start: number; end: number }[] = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (m[0].trim().length > 0) windows.push({ start, end });
  }
  return windows;
}

const FUZZY_MIN_OVERLAP = 0.7;

/**
 * Bind a quote to its location in the cited source version. Deterministic.
 * Offsets always index the ORIGINAL text; `match` records how loose the match was.
 */
export function bindEvidenceSpan(args: {
  quote: string;
  sourceText: string;
  sourceHash: string;
}): EvidenceBinding {
  const quote = args.quote?.trim();
  if (!quote) return { status: "no_evidence", reason: "extractor_returned_no_quote" };

  // 1. Exact match (first occurrence — deterministic).
  const exactAt = args.sourceText.indexOf(quote);
  if (exactAt >= 0) {
    return {
      status: "bound",
      span: { quote, start: exactAt, end: exactAt + quote.length, source_hash: args.sourceHash, match: "exact" },
    };
  }

  // 2. Normalized match (whitespace/quote/dash/case folding, offsets mapped back).
  const src = normalizeWithMap(args.sourceText);
  const q = normalizeWithMap(quote);
  if (q.norm.length > 0) {
    const at = src.norm.indexOf(q.norm);
    if (at >= 0) {
      const start = src.map[at];
      const lastNormIdx = at + q.norm.length - 1;
      const end = src.map[lastNormIdx] + 1;
      return {
        status: "bound",
        span: { quote, start, end, source_hash: args.sourceHash, match: "normalized" },
      };
    }
  }

  // 3. Bounded fuzzy: best sentence window (or pair) by token overlap, length-bounded.
  const quoteTokens = new Set(tokenize(quote));
  if (quoteTokens.size >= 4) {
    const windows = sentenceWindows(args.sourceText);
    let best: { start: number; end: number; score: number } | null = null;
    for (let i = 0; i < windows.length; i++) {
      for (let span = 1; span <= 2 && i + span - 1 < windows.length; span++) {
        const start = windows[i].start;
        const end = windows[i + span - 1].end;
        const len = end - start;
        if (len < quote.length * 0.5 || len > quote.length * 2.5) continue;
        const winTokens = new Set(tokenize(args.sourceText.slice(start, end)));
        let hit = 0;
        for (const t of quoteTokens) if (winTokens.has(t)) hit++;
        const score = hit / quoteTokens.size;
        if (score >= FUZZY_MIN_OVERLAP && (!best || score > best.score)) {
          best = { start, end, score };
        }
      }
    }
    if (best) {
      return {
        status: "bound",
        span: { quote, start: best.start, end: best.end, source_hash: args.sourceHash, match: "fuzzy" },
      };
    }
  }

  return { status: "unbound", reason: "quote_not_found" };
}

export type SpanVerification =
  | { ok: true; match: EvidenceMatchKind }
  | { ok: false; reason: "hash_mismatch" | "offsets_out_of_range" | "text_changed" };

/**
 * Layer-1 re-check, runnable by anyone at any time with no model: the source version
 * still hashes the same, the offsets are in range, and the text at the offsets still
 * carries the quote (at the recorded match strictness).
 */
export function verifyEvidenceSpan(args: {
  span: EvidenceSpan;
  sourceText: string;
  sourceHash: string;
}): SpanVerification {
  const { span } = args;
  if (args.sourceHash !== span.source_hash) return { ok: false, reason: "hash_mismatch" };
  if (span.start < 0 || span.end > args.sourceText.length || span.end <= span.start) {
    return { ok: false, reason: "offsets_out_of_range" };
  }
  const slice = args.sourceText.slice(span.start, span.end);
  if (span.match === "exact") {
    return slice === span.quote ? { ok: true, match: "exact" } : { ok: false, reason: "text_changed" };
  }
  if (span.match === "normalized") {
    return normalizeWithMap(slice).norm === normalizeWithMap(span.quote).norm
      ? { ok: true, match: "normalized" }
      : { ok: false, reason: "text_changed" };
  }
  const quoteTokens = new Set(tokenize(span.quote));
  if (quoteTokens.size === 0) return { ok: false, reason: "text_changed" };
  const winTokens = new Set(tokenize(slice));
  let hit = 0;
  for (const t of quoteTokens) if (winTokens.has(t)) hit++;
  return hit / quoteTokens.size >= FUZZY_MIN_OVERLAP
    ? { ok: true, match: "fuzzy" }
    : { ok: false, reason: "text_changed" };
}

export type UnitEvidenceBinding = { unitId: string; binding: EvidenceBinding };

/** Bind every extracted unit's evidence quote against the cited source version. */
export function bindUnitsEvidence(args: {
  units: Pick<ExtractedUnit, "id" | "evidence">[];
  sourceText: string;
  sourceHash: string;
}): UnitEvidenceBinding[] {
  return args.units.map((unit) => ({
    unitId: unit.id,
    binding: bindEvidenceSpan({
      quote: unit.evidence ?? "",
      sourceText: args.sourceText,
      sourceHash: args.sourceHash,
    }),
  }));
}
