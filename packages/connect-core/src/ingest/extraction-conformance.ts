/**
 * Shared contract-conformance suite for the extraction port (plugpoints: "one
 * shared contract-conformance suite per port, parameterised over every registered
 * adapter"). Every registered adapter runs the SAME assertions, so an adapter that
 * merely "usually" honours the contract fails here, not in production.
 *
 * Assertions per adapter:
 *  1. Output parses against the Zod contract (`ConnectExtractionResultSchema`).
 *  2. Verbatim round-trip: every unit with offsets re-resolves byte-identically to
 *     its stored `text` (extraction-provenance.assertProvenanceRoundTrip).
 *  3. Tier is mechanical, not declarative: a `spatial`-tier document has a spatial
 *     locator on EVERY unit; a `textual`-tier document is honestly labelled.
 *  4. Named-error taxonomy: empty input throws `ExtractionError`, never returns
 *     `{ text_units: [] }` (no fabricated empty success).
 *  5. Determinism: extracting the same input twice yields the same canonical text
 *     and the same version-hash inputs (the verdict cache depends on this).
 *
 * This module exports the runner as a plain function so it can be invoked from a
 * vitest file (which supplies `describe/it/expect`) without connect-core taking a
 * test-framework dependency in `src`.
 */
import {
  ConnectExtractionResultSchema,
  type ConnectExtractionResult,
} from "@restormel/contracts/connect";
import { ExtractionError, type ExtractionConnector, type ExtractionSourceDocument } from "./extraction-connector.js";
import { assertProvenanceRoundTrip } from "./extraction-provenance.js";

export interface ConformanceCase {
  connector: ExtractionConnector;
  /** A representative input the connector CAN extract (fixture-backed for network adapters). */
  sample: ExtractionSourceDocument;
}

export interface ConformanceFindings {
  connectorId: string;
  schemaOk: boolean;
  roundTripOk: boolean;
  tierConsistent: boolean;
  emptyThrows: boolean;
  deterministic: boolean;
  tier: ConnectExtractionResult["document"]["capability_tier"];
  errors: string[];
}

/** Run the full conformance pass for one adapter and return structured findings. */
export async function runConformance(testCase: ConformanceCase): Promise<ConformanceFindings> {
  const { connector, sample } = testCase;
  const errors: string[] = [];

  const result = await connector.extract(sample);

  // 1. Schema.
  const parsed = ConnectExtractionResultSchema.safeParse(result);
  const schemaOk = parsed.success;
  if (!schemaOk) errors.push(`schema: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);

  // 2. Round-trip.
  const rt = assertProvenanceRoundTrip(result);
  const roundTripOk = rt.ok;
  if (!roundTripOk) errors.push(`roundtrip: ${rt.failures.map((f) => `#${f.index}:${f.reason}`).join(",")}`);

  // 3. Tier is mechanical.
  const allSpatial = result.text_units.every((u) => u.source_locator.kind === "spatial");
  const tier = result.document.capability_tier;
  const tierConsistent = tier === "spatial" ? allSpatial : true;
  if (!tierConsistent) errors.push("tier: declared spatial but not every unit has a spatial locator");
  // The connector must never over-declare beyond its own ceiling.
  if (tier === "spatial" && connector.declaredTier === "textual") {
    errors.push("tier: emitted spatial from a textual-declared connector");
  }

  // 4. Empty input throws a named error (no fabricated empty success).
  let emptyThrows = false;
  try {
    await connector.extract({ ...sample, bytes: new Uint8Array(0) });
  } catch (err) {
    emptyThrows = err instanceof ExtractionError;
    if (!emptyThrows) errors.push(`empty: threw non-ExtractionError ${String(err)}`);
  }
  if (!emptyThrows) errors.push("empty: did not throw ExtractionError on empty input");

  // 5. Determinism.
  const again = await connector.extract(sample);
  const canonicalA = result.text_units.map((u) => u.text).join("\n");
  const canonicalB = again.text_units.map((u) => u.text).join("\n");
  const deterministic =
    canonicalA === canonicalB &&
    result.document.version_hash_inputs.canonical_text_sha256 ===
      again.document.version_hash_inputs.canonical_text_sha256;
  if (!deterministic) errors.push("determinism: repeated extraction differed");

  return {
    connectorId: connector.id,
    schemaOk,
    roundTripOk,
    tierConsistent,
    emptyThrows,
    deterministic,
    tier,
    errors,
  };
}
