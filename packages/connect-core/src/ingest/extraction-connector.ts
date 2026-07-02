/**
 * Ingest-connector abstraction — instance #1: extraction (REC-TECH-014, build
 * step 1A of REC-ADR-023). This is the PORT the verification spine consumes from
 * any extractor. It is model-agnostic by design: the managed default
 * (PaddleOCR-VL) and the curated alternative (Mistral OCR API, pure-extraction)
 * implement the identical `extract()` contract, so a swap is a config change with
 * zero spine edits (the swap test's zero-spine-diff criterion).
 *
 * Design rationale (why a port, not a hardcoded call):
 *  - D-2026-07-02-1 makes clean removability a merge gate. A component reached only
 *    through this port greps to its adapter + config + test; excising it is
 *    `git rm` the adapter dir + delete the config entry, no spine edits.
 *  - The contract's `source_locator` is the provenance through-line (ADR invariant 2)
 *    and is door-agnostic (also serves proxy Tier P2).
 *  - No vendor SDK type appears in this file (plugpoints rule: ports carry zero
 *    vendor types; domain types come from `@restormel/contracts/connect`).
 *
 * Credentialed/network implementations belong in the host app, mirroring the
 * GraphStore port pattern. To keep connect-core credential-free AND fixture-testable
 * without a GPU or an API key, network adapters here take an injected transport
 * (a `fetch`-shaped function) via the constructor — never a `process.env` read.
 */
import type {
  ConnectExtractionResult,
  ConnectCapabilityTier,
  ConnectOffsetUnit,
  ConnectSourceLocator,
} from "@restormel/contracts/connect";

/** Raw document handed to an extractor. Bytes + mime + a stable source id. */
export interface ExtractionSourceDocument {
  /** Stable identifier for this source (carried into `document.source_id`). */
  sourceId: string;
  /** Raw file bytes — hashed for `raw_file_sha256` and sent to the extractor. */
  bytes: Uint8Array;
  mime: string;
  name: string;
}

/**
 * The extraction port. `extract()` returns the REC-TECH-014 contract verbatim.
 * `readonly id` is the neutral adapter discriminant recorded in provenance and
 * cache keys (never a vendor payload shape). `version` participates in the
 * source-version hash so a swap re-versions dependent verdicts.
 */
export interface ExtractionConnector {
  readonly id: string;
  readonly version: string;
  /** The highest provenance tier this connector can ever emit (declared, honest). */
  readonly declaredTier: ConnectCapabilityTier;
  extract(input: ExtractionSourceDocument): Promise<ConnectExtractionResult>;
}

/**
 * Named error taxonomy — never map a failure to a silent pass or an empty result.
 * The verification-engineering skill forbids fabricated outcomes; extraction
 * failures surface as these, not as `{ text_units: [] }`.
 */
export class ExtractionError extends Error {
  readonly code:
    | "unsupported_mime"
    | "empty_source"
    | "transport_failed"
    | "malformed_response"
    | "credential_missing";
  readonly connectorId: string;
  constructor(
    code: ExtractionError["code"],
    connectorId: string,
    message: string,
  ) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
    this.connectorId = connectorId;
  }
}

/**
 * Derive the honest document tier from the locators actually produced. Tier A
 * (`spatial`) requires EVERY unit to carry a spatial locator — one textual unit
 * downgrades the whole document to Tier B (plugpoints: "usually emits bboxes" is
 * tier B). This is mechanical, never declarative.
 */
export function deriveCapabilityTier(
  locators: ReadonlyArray<Pick<ConnectSourceLocator, "kind">>,
): ConnectCapabilityTier {
  if (locators.length === 0) return "textual";
  return locators.every((l) => l.kind === "spatial") ? "spatial" : "textual";
}

/** Offset semantics used by all connect-core canonical text: JS-native slice. */
export const CANONICAL_OFFSET_UNIT: ConnectOffsetUnit = "utf16";
