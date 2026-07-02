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
 * Scope §4(c) — "span-anchoring AND verification outcomes compared across connectors":
 *  - Span-anchoring: unit counts, tier, per-unit locator re-resolution, canonical-text
 *    overlap.
 *  - Verification outcomes: the MODEL-FREE half of a verifier's decision — whether a
 *    fixed set of claim quotes each BINDS to a byte-identical evidence span in a
 *    connector's output (`claimBindingDeltas`). A verifier's input is exactly
 *    (bound quote + locator); if a claim binds under the default but not the
 *    alternative, the verifier would `abstain` on the alternative for want of bound
 *    evidence — a real, judge-free verification-outcome delta. The JUDGE-VERDICT half
 *    (entailed/contradicted/abstained on the bound span) is DEFERRED to the cascade
 *    (ADR build step 1B): it requires a cross-model entailment judge (`entailment.ts`)
 *    and a live credential, both out of spike-1A scope, and fabricating a fixture
 *    verdict here would violate eval-honesty §7. This split is disclosed, not implied.
 *
 * The comparison does NOT require the two connectors to agree on text (different OCR
 * engines legitimately differ); it documents the deltas so degradation is honest and
 * labelled.
 */
import type { ConnectExtractionResult } from "@restormel/contracts/connect";
import type { ExtractionConnector, ExtractionSourceDocument } from "./extraction-connector.js";
import { assertProvenanceRoundTrip, buildCanonicalText } from "./extraction-provenance.js";

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

/**
 * Per-claim, model-free verification-outcome comparison: does this claim quote bind to
 * a byte-identical evidence span in each connector's canonical text? This is the input
 * a verifier receives; a `false` means the verifier would abstain (no bound evidence).
 */
export interface ClaimBindingDelta {
  claim: string;
  boundInDefault: boolean;
  boundInAlternative: boolean;
  /** true when the claim binds in one connector but not the other — a verifier-visible delta. */
  bindingDiffers: boolean;
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
  /**
   * Model-free verification-outcome deltas (Scope §4c). Empty when no claim set was
   * supplied. The judge-verdict delta is deferred to the cascade (1B) — see file header.
   */
  claimBindingDeltas: ClaimBindingDelta[];
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

/**
 * Does `claim` bind to a byte-identical evidence span in this result? A verifier is
 * fed (bound quote + locator); binding here means the exact claim substring survives
 * into the connector's canonical text where a locator could anchor it. Model-free.
 */
function claimBinds(result: ConnectExtractionResult, claim: string): boolean {
  return buildCanonicalText(result.text_units).includes(claim);
}

/** Run the same source through both connectors and produce the delta report. */
export async function runSwapTest(args: {
  default: ExtractionConnector;
  alternative: ExtractionConnector;
  source: ExtractionSourceDocument;
  /**
   * Claim quotes to compare for model-free binding (Scope §4c verification-outcome
   * half). Optional; when omitted, `claimBindingDeltas` is empty and only span-anchoring
   * is compared. The judge-verdict half is deferred to 1B (see file header).
   */
  claims?: string[];
}): Promise<SwapTestDelta> {
  const [defaultResult, altResult] = await Promise.all([
    args.default.extract(args.source),
    args.alternative.extract(args.source),
  ]);

  const defTokens = tokens(defaultResult);
  const altTokens = tokens(altResult);
  const intersection = [...defTokens].filter((t) => altTokens.has(t)).length;
  const union = new Set([...defTokens, ...altTokens]).size;

  const claimBindingDeltas: ClaimBindingDelta[] = (args.claims ?? []).map((claim) => {
    const boundInDefault = claimBinds(defaultResult, claim);
    const boundInAlternative = claimBinds(altResult, claim);
    return {
      claim,
      boundInDefault,
      boundInAlternative,
      bindingDiffers: boundInDefault !== boundInAlternative,
    };
  });

  return {
    identicalContract: true,
    default_: summarize(args.default, defaultResult),
    alternative: summarize(args.alternative, altResult),
    unitCountDelta: altResult.text_units.length - defaultResult.text_units.length,
    tierChanged: defaultResult.document.capability_tier !== altResult.document.capability_tier,
    canonicalTokenOverlap: union === 0 ? 1 : intersection / union,
    claimBindingDeltas,
  };
}
