/**
 * Swap test — PROVABLE, not asserted (REC-TECH-014 §Scope 4; plugpoints "swap test").
 *
 * Runs the SAME source through two connectors (the managed default and a curated
 * alternative), both consumed through the IDENTICAL `ExtractionConnector.extract()`
 * contract, and produces a cross-connector outcome-delta report. The spine-diff
 * criterion (a) — "zero changes to verification-spine code between runs" — is proven
 * OUTSIDE this module by construction: this harness calls only `extract()`; it
 * imports no spine module and swapping the connector is a parameter, not a code path.
 * The PR attaches the `git diff` of spine files (empty) alongside this delta table.
 *
 * The comparison (c) covers: unit counts, tier, per-unit span-anchoring (does each
 * connector's locator re-resolve), and canonical-text overlap — the observable
 * differences a downstream verifier would see. It does NOT require the two
 * connectors to agree on text (different OCR engines legitimately differ); it
 * documents the deltas so degradation is honest and labelled.
 */
import type { ConnectExtractionResult } from "@restormel/contracts/connect";
import type { ExtractionConnector, ExtractionSourceDocument } from "./extraction-connector.js";
import { assertProvenanceRoundTrip } from "./extraction-provenance.js";

export interface ConnectorRunSummary {
  connectorId: string;
  connectorVersion: string;
  declaredTier: ConnectExtractionResult["document"]["capability_tier"];
  emittedTier: ConnectExtractionResult["document"]["capability_tier"];
  unitCount: number;
  /** Fraction of units whose locator re-resolves byte-identically. */
  spanAnchorRate: number;
  canonicalTextLength: number;
  sourceVersionInputs: ConnectExtractionResult["document"]["version_hash_inputs"];
}

export interface SwapTestDelta {
  /** Both consumed through the identical contract — always true here by construction. */
  identicalContract: true;
  default_: ConnectorRunSummary;
  alternative: ConnectorRunSummary;
  unitCountDelta: number;
  tierChanged: boolean;
  /** Jaccard-ish overlap of canonical tokens between the two connectors' output. */
  canonicalTokenOverlap: number;
}

function summarize(connector: ExtractionConnector, result: ConnectExtractionResult): ConnectorRunSummary {
  const rt = assertProvenanceRoundTrip(result);
  const anchorable = result.text_units.filter((u) => {
    const loc = u.source_locator;
    return loc.kind === "textual" || (loc.kind === "spatial" && loc.offset !== undefined);
  }).length;
  return {
    connectorId: connector.id,
    connectorVersion: connector.version,
    declaredTier: connector.declaredTier,
    emittedTier: result.document.capability_tier,
    unitCount: result.text_units.length,
    spanAnchorRate: anchorable === 0 ? 0 : rt.resolved / anchorable,
    canonicalTextLength: result.text_units.map((u) => u.text).join("\n").length,
    sourceVersionInputs: result.document.version_hash_inputs,
  };
}

function tokens(result: ConnectExtractionResult): Set<string> {
  return new Set(
    result.text_units
      .map((u) => u.text)
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1),
  );
}

/** Run the same source through both connectors and produce the delta report. */
export async function runSwapTest(args: {
  default: ExtractionConnector;
  alternative: ExtractionConnector;
  source: ExtractionSourceDocument;
}): Promise<SwapTestDelta> {
  const [defaultResult, altResult] = await Promise.all([
    args.default.extract(args.source),
    args.alternative.extract(args.source),
  ]);

  const defTokens = tokens(defaultResult);
  const altTokens = tokens(altResult);
  const intersection = [...defTokens].filter((t) => altTokens.has(t)).length;
  const union = new Set([...defTokens, ...altTokens]).size;

  return {
    identicalContract: true,
    default_: summarize(args.default, defaultResult),
    alternative: summarize(args.alternative, altResult),
    unitCountDelta: altResult.text_units.length - defaultResult.text_units.length,
    tierChanged: defaultResult.document.capability_tier !== altResult.document.capability_tier,
    canonicalTokenOverlap: union === 0 ? 1 : intersection / union,
  };
}
