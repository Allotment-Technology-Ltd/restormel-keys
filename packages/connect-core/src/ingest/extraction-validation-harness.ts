/**
 * Indicative validation harness (REC-TECH-014 §Scope 5) — INDICATIVE ONLY. Runs a
 * small representative sample (a handful of legal/pharma/finance-shaped documents)
 * through a connector and reports: extraction fidelity (presence of known sentences —
 * a machine-checkable binary unit test per verification-engineering §7 "extractor
 * evals are binary unit tests"), span-anchoring quality (round-trip rate),
 * confidence-as-abstention signal (units below a threshold), degradation behaviour
 * (tier actually achieved), and indicative throughput/cost.
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
  tier: ConnectExtractionResult["document"]["capability_tier"];
  /** All required sentences present verbatim? (binary fidelity) */
  fidelityOk: boolean;
  missingSentences: string[];
  /** Fraction of anchorable units whose locator re-resolves. */
  spanAnchorRate: number;
  /** Count of units flagged for ingest-level abstention (confidence below threshold). */
  lowConfidenceUnits: number;
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
    note: string;
  };
}

/** Run the indicative validation over a small corpus. */
export async function runIndicativeValidation(args: {
  connector: ExtractionConnector;
  corpus: IndicativeCorpusItem[];
  execution: "fixture" | "live";
  abstentionThreshold?: number;
}): Promise<IndicativeReport> {
  const abstentionThreshold = args.abstentionThreshold ?? 0.6;
  const items: IndicativeItemResult[] = [];

  for (const item of args.corpus) {
    const result = await args.connector.extract(item.source);
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
      tier: result.document.capability_tier,
      fidelityOk: missing.length === 0,
      missingSentences: missing,
      spanAnchorRate: anchorable === 0 ? 0 : rt.resolved / anchorable,
      lowConfidenceUnits: result.text_units.filter((u) => u.confidence < abstentionThreshold).length,
    });
  }

  const tierDistribution: Record<string, number> = {};
  for (const it of items) tierDistribution[it.tier] = (tierDistribution[it.tier] ?? 0) + 1;
  const fidelityPassRate = items.length === 0 ? 0 : items.filter((i) => i.fidelityOk).length / items.length;
  const meanSpanAnchorRate =
    items.length === 0 ? 0 : items.reduce((a, i) => a + i.spanAnchorRate, 0) / items.length;

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
      note: "INDICATIVE only — the >=90%/<=2% bar is the cascade-validation harness / weekly CI gate (ADR step 2), not this spike.",
    },
  };
}
