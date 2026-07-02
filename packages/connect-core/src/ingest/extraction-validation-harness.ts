/**
 * Indicative validation harness (REC-TECH-014 §Scope 5) — INDICATIVE ONLY. Runs a
 * small representative sample (a handful of legal/pharma/finance-shaped documents)
 * through a connector and reports: extraction fidelity (presence of known sentences —
 * a machine-checkable binary unit test per verification-engineering §7 "extractor
 * evals are binary unit tests"), span-anchoring quality (round-trip rate),
 * confidence-as-abstention signal (units below a threshold), degradation behaviour
 * (tier actually achieved), and indicative throughput + per-page cost (Scope §5).
 *
 * HONEST MEASUREMENT BOUNDARY (REC-ADR-016 culture):
 * - Throughput IS measured here — wall-clock pages/second around `extract()`. Under
 *   `execution:"fixture"` this reflects the double + mapping code, NOT a live model,
 *   so the number is stamped `execution` and must not be read as a live-connector
 *   throughput. It becomes meaningful only on a live run.
 * - Per-page cost is NOT computable under fixtures: the doubles carry no vendor price,
 *   and connect-core is credential-free (no billing surface). `perPageCostUsd` is
 *   therefore `null` under fixtures and MUST be populated by the host app on a live
 *   run from the provider `usage`/pricing (never a client-side estimate — see
 *   verification-engineering §8). Reporting `null` here is the honest state, not a
 *   silent omission. Follow-up: cost/latency OTel attributes (§8 attribute set) land
 *   with the cascade-validation harness (ADR build step 2) — tracked as the step-2
 *   instrumentation item in the ADR "Spike 1A findings" section.
 *
 * EXPLICITLY NOT the ≥90%/≤2% benchmark — that is the cascade-validation harness and
 * the weekly CI gate (ADR build step 2). Every number here is stamped INDICATIVE so
 * it is never mistaken for the gate. Per verification-engineering §7 "fixture vs live
 * labelled", each report carries an `execution` field ("fixture" | "live").
 */
import type { ConnectExtractionResult } from "@restormel/contracts/connect";
import type { ExtractionConnector, ExtractionSourceDocument } from "./extraction-connector.js";
import { assertProvenanceRoundTrip } from "./extraction-provenance.js";

export interface IndicativeCorpusItem {
  docType: "legal" | "pharma" | "finance";
  source: ExtractionSourceDocument;
  /** Sentences that MUST appear verbatim in the extracted text (binary fidelity check). */
  mustContain: string[];
}

export interface IndicativeItemResult {
  docType: IndicativeCorpusItem["docType"];
  sourceId: string;
  unitCount: number;
  pageCount: number;
  tier: ConnectExtractionResult["document"]["capability_tier"];
  /** All required sentences present verbatim? (binary fidelity) */
  fidelityOk: boolean;
  missingSentences: string[];
  /** Fraction of anchorable units whose locator re-resolves. */
  spanAnchorRate: number;
  /** Count of units flagged for ingest-level abstention (confidence below threshold). */
  lowConfidenceUnits: number;
  /**
   * Wall-clock milliseconds for this document's `extract()` call. Under
   * `execution:"fixture"` this times the double + mapping code, NOT a live model.
   */
  extractMs: number;
  /**
   * Per-page cost in USD. `null` under fixtures (connect-core is credential-free and
   * the doubles carry no vendor price); the host app populates this on a live run from
   * the provider `usage`/pricing. Never a client-side estimate (§8).
   */
  perPageCostUsd: number | null;
}

export interface IndicativeReport {
  connectorId: string;
  connectorVersion: string;
  execution: "fixture" | "live";
  abstentionThreshold: number;
  items: IndicativeItemResult[];
  /** INDICATIVE aggregate — never the CI gate. */
  summary: {
    totalDocs: number;
    fidelityPassRate: number;
    meanSpanAnchorRate: number;
    tierDistribution: Record<string, number>;
    /**
     * Indicative throughput: pages per second across the sample (total pages / total
     * extract wall-clock). Meaningful only on a live run; under fixtures it times the
     * double, so it is reported alongside `execution` and must be read with it.
     */
    indicativePagesPerSec: number | null;
    /**
     * Mean per-page cost across items that reported one. `null` under fixtures (no
     * vendor price in the doubles) — the honest state, not an omission (§8).
     */
    meanPerPageCostUsd: number | null;
    note: string;
  };
}

/**
 * Page count for throughput. Prefer the connector's declared `page_count`; a Tier-B
 * textual connector may not know it (offsets carry no page), so fall back to the
 * distinct spatial pages present, else 1 (a single logical page) so pages/sec stays
 * defined and never zero-divides.
 */
function pageCountOf(result: ConnectExtractionResult): number {
  if (typeof result.document.page_count === "number" && result.document.page_count > 0) {
    return result.document.page_count;
  }
  const pages = new Set<number>();
  for (const u of result.text_units) {
    if (u.source_locator.kind === "spatial") pages.add(u.source_locator.page);
  }
  return pages.size > 0 ? pages.size : 1;
}

/** Run the indicative validation over a small corpus. */
export async function runIndicativeValidation(args: {
  connector: ExtractionConnector;
  corpus: IndicativeCorpusItem[];
  execution: "fixture" | "live";
  abstentionThreshold?: number;
  /**
   * Optional live-cost hook. connect-core is credential-free and knows no vendor
   * pricing, so per-page cost is supplied by the host app on a live run (from the
   * provider `usage` fields + pricing — never a client-side estimate, §8). Omitted
   * under fixtures ⇒ `perPageCostUsd` is `null`, the honest state.
   */
  perPageCostUsd?: (result: ConnectExtractionResult) => number | null;
}): Promise<IndicativeReport> {
  const abstentionThreshold = args.abstentionThreshold ?? 0.6;
  const items: IndicativeItemResult[] = [];

  for (const item of args.corpus) {
    const startedAt = performance.now();
    const result = await args.connector.extract(item.source);
    const extractMs = performance.now() - startedAt;
    const canonical = result.text_units.map((u) => u.text).join("\n");
    const missing = item.mustContain.filter((s) => !canonical.includes(s));
    const rt = assertProvenanceRoundTrip(result);
    const anchorable = result.text_units.filter((u) => {
      const loc = u.source_locator;
      return loc.kind === "textual" || (loc.kind === "spatial" && loc.offset !== undefined);
    }).length;
    items.push({
      docType: item.docType,
      sourceId: result.document.source_id,
      unitCount: result.text_units.length,
      pageCount: pageCountOf(result),
      tier: result.document.capability_tier,
      fidelityOk: missing.length === 0,
      missingSentences: missing,
      spanAnchorRate: anchorable === 0 ? 0 : rt.resolved / anchorable,
      lowConfidenceUnits: result.text_units.filter((u) => u.confidence < abstentionThreshold).length,
      extractMs,
      perPageCostUsd: args.perPageCostUsd ? args.perPageCostUsd(result) : null,
    });
  }

  const tierDistribution: Record<string, number> = {};
  for (const it of items) tierDistribution[it.tier] = (tierDistribution[it.tier] ?? 0) + 1;
  const fidelityPassRate = items.length === 0 ? 0 : items.filter((i) => i.fidelityOk).length / items.length;
  const meanSpanAnchorRate =
    items.length === 0 ? 0 : items.reduce((a, i) => a + i.spanAnchorRate, 0) / items.length;

  const totalPages = items.reduce((a, i) => a + i.pageCount, 0);
  const totalMs = items.reduce((a, i) => a + i.extractMs, 0);
  const indicativePagesPerSec = totalMs === 0 ? null : totalPages / (totalMs / 1000);
  const costed = items.filter((i) => i.perPageCostUsd !== null) as Array<
    IndicativeItemResult & { perPageCostUsd: number }
  >;
  const meanPerPageCostUsd =
    costed.length === 0 ? null : costed.reduce((a, i) => a + i.perPageCostUsd, 0) / costed.length;

  return {
    connectorId: args.connector.id,
    connectorVersion: args.connector.version,
    execution: args.execution,
    abstentionThreshold,
    items,
    summary: {
      totalDocs: items.length,
      fidelityPassRate,
      meanSpanAnchorRate,
      tierDistribution,
      indicativePagesPerSec,
      meanPerPageCostUsd,
      note:
        "INDICATIVE only — the >=90%/<=2% bar is the cascade-validation harness / weekly CI gate " +
        "(ADR step 2), not this spike. Throughput times the fixture double under execution:fixture; " +
        "per-page cost is null until a live run supplies provider usage/pricing via the host app.",
    },
  };
}
