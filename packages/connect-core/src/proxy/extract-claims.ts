/**
 * Verifying proxy — claim extraction + quote retrieval. (planning/w2-1-phase-a-reference-integration.md)
 *
 * Two jobs, both hermetic (no MCP, no keys here — the validator is injected):
 *
 *  1. parseMode1Result: turn a Mode-1 upstream payload ({answer, claims?, sources}) into
 *     ClaimWithSources[]. Explicit claims are used when present; otherwise the whole answer is
 *     one claim. Each claim is paired with the upstream's cited sources to verify against.
 *
 *  2. retrieveQuotes: the quote-retrieval contract — the REAL net-new verification work, not a
 *     façade. When the upstream supplied verbatim quotes we use them as-is. Otherwise we ask the
 *     injected validator to copy verbatim supporting sentence(s) out of the cited source for each
 *     claim (character-for-character, empty when nothing supports it). Those candidate quotes are
 *     then bound deterministically by EBV Layer 1 — a quote that cannot be located in its cited
 *     source can never make the claim "supported".
 *
 * The retrieval prompt mirrors the evidence contract used by scripts/reviews/verifier-efficacy.ts
 * so the same parse/cost behaviour applies.
 */
import type { ExtractionGenerate } from "../ingest/extract.js";
import type { ClaimWithSources, Mode1Result, Mode1Source } from "./types.js";

/** Decompose a Mode-1 result into per-claim verification inputs. */
export function parseMode1Result(result: Mode1Result): ClaimWithSources[] {
  const sources = (result.sources ?? []).filter(
    (s): s is Mode1Source => !!s && typeof s.id === "string" && typeof s.text === "string",
  );
  const explicit = (result.claims ?? [])
    .map((c) => (typeof c === "string" ? c.trim() : ""))
    .filter((c) => c.length > 0);
  const claims = explicit.length > 0 ? explicit : [String(result.answer ?? "").trim()].filter(Boolean);
  return claims.map((claim) => ({ claim, sources }));
}

export const EVIDENCE_RETRIEVAL_SYSTEM =
  `You are an evidence retriever. For each claim, copy the exact sentence(s) from the ` +
  `SOURCE TEXT that support it — character-for-character, no paraphrase, no abbreviation. ` +
  `If nothing in the source supports the claim, return an empty string for it. ` +
  `Return STRICT JSON only:\n` +
  `{ "results": [{ "ref": "<ref>", "quote": "<verbatim quote or empty string>" }] }\n` +
  `Include one result for every listed ref.`;

function buildRetrievalUserPrompt(
  sourceText: string,
  claims: { ref: string; claim: string }[],
): string {
  return (
    `SOURCE TEXT:\n${sourceText}\n\n` +
    claims.map((c) => `CLAIM ${c.ref}: ${c.claim}`).join("\n")
  );
}

function parseQuoteResponse(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s < 0 || e <= s) return out;
    try {
      obj = JSON.parse(raw.slice(s, e + 1));
    } catch {
      return out;
    }
  }
  const results = Array.isArray((obj as Record<string, unknown>)?.results)
    ? ((obj as Record<string, unknown>).results as unknown[])
    : [];
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    if (typeof rec.ref === "string" && rec.ref.trim()) {
      out.set(rec.ref.trim(), typeof rec.quote === "string" ? rec.quote : "");
    }
  }
  return out;
}

/**
 * For each (claim, source) pair, return a candidate verbatim quote to bind. Upstream-supplied
 * quotes win (0 validator calls). Otherwise the injected validator retrieves quotes from each
 * cited source; if retrieval throws or returns nothing, the quote is empty → unbound → abstain
 * (fail-safe; never silently passed).
 *
 * Result: a map keyed `${claimIndex}::${sourceId}` → candidate quote string ("" = none).
 */
export async function retrieveQuotes(args: {
  claims: ClaimWithSources[];
  generate: ExtractionGenerate;
}): Promise<Map<string, string>> {
  const quotes = new Map<string, string>();

  // 1. Use upstream-supplied verbatim quotes verbatim (no validator call).
  const needRetrieval: { claimIndex: number; claim: string; source: Mode1Source }[] = [];
  args.claims.forEach((cw, claimIndex) => {
    const supplied = (cw.quotes ?? []).filter((q) => typeof q === "string" && q.trim().length > 0);
    for (const source of cw.sources) {
      const key = `${claimIndex}::${source.id}`;
      if (supplied.length > 0) {
        // Bind against whichever cited source the quote actually lives in (Layer 1 decides).
        quotes.set(key, supplied[0]!);
      } else {
        needRetrieval.push({ claimIndex, claim: cw.claim, source });
      }
    }
  });

  if (needRetrieval.length === 0) return quotes;

  // 2. Retrieve missing quotes per source (batched per source so the prompt carries the text once).
  const bySource = new Map<string, { source: Mode1Source; items: { ref: string; claimIndex: number; claim: string }[] }>();
  for (const n of needRetrieval) {
    const bucket = bySource.get(n.source.id) ?? { source: n.source, items: [] };
    bucket.items.push({ ref: `c${n.claimIndex}`, claimIndex: n.claimIndex, claim: n.claim });
    bySource.set(n.source.id, bucket);
  }

  for (const { source, items } of bySource.values()) {
    let retrieved = new Map<string, string>();
    try {
      const raw = await args.generate({
        system: EVIDENCE_RETRIEVAL_SYSTEM,
        user: buildRetrievalUserPrompt(
          source.text,
          items.map((i) => ({ ref: i.ref, claim: i.claim })),
        ),
      });
      retrieved = parseQuoteResponse(raw);
    } catch {
      // Validator-unreachable: leave quotes empty → unbound → abstain (fail-safe).
      retrieved = new Map();
    }
    for (const item of items) {
      const key = `${item.claimIndex}::${source.id}`;
      quotes.set(key, retrieved.get(item.ref) ?? "");
    }
  }

  return quotes;
}
