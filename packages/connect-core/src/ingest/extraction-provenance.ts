/**
 * Extraction provenance -- the source-version hash and the deterministic,
 * model-free locator round-trip (REC-ADR-023 invariant 2; REC-TECH-014 section Scope 4;
 * verification-engineering section 2 "both hashes stored" + "locator survives end-to-end").
 *
 * Two jobs:
 *  1. `computeVersionHashInputs` -- hash the canonical extracted text AND the raw
 *     file, plus the extractor id+version. Both hashes are stored: the raw hash
 *     pins the byte source; the canonical-text hash pins what verifiers actually
 *     read; the extractor id+version means an extractor SWAP re-versions the hash,
 *     so dependent verdicts miss the cache by construction (REC-PLAN-023).
 *  2. `reresolveLocator` / `assertProvenanceRoundTrip` -- re-slice canonical text at
 *     each unit's textual offsets and confirm it is byte-identical to the unit's
 *     stored `text`. This is the quote-in-doc self-check that detects broken offsets:
 *     anyone can re-run it with no model. Offsets are UTF-16 (native `String.slice`),
 *     matching the declared `offset_unit`.
 *
 * Hashing reuses `contentHash` (Web Crypto, no node:crypto) so this module is safe
 * if barrel-imported on a client.
 */
import type {
  ConnectExtractionResult,
  ConnectSourceLocator,
  ConnectTextUnit,
} from "@restormel/contracts/connect";
import { contentHash } from "./evidence-binding.js";

/** SHA-256 (hex) of raw bytes, via Web Crypto. */
async function bytesHash(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer-backed view so the digest input is a plain
  // BufferSource regardless of the caller's (possibly SharedArrayBuffer) backing.
  const buf = new Uint8Array(bytes.length);
  buf.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The canonical extracted text is the verbatim `text` of every unit joined in
 * reading order by a single "\n". Textual offsets index INTO this string. Building
 * it here (rather than trusting a connector's own concatenation) keeps the
 * offset<->text contract owned by Restormel, not the vendor.
 */
export function buildCanonicalText(units: ReadonlyArray<Pick<ConnectTextUnit, "text">>): string {
  return units.map((u) => u.text).join("\n");
}

export interface VersionHashInputs {
  canonical_text_sha256: string;
  raw_file_sha256: string;
  extractor_id: string;
  extractor_version: string;
}

/** Compute the stored version-hash inputs for a document. */
export async function computeVersionHashInputs(args: {
  canonicalText: string;
  rawBytes: Uint8Array;
  extractorId: string;
  extractorVersion: string;
}): Promise<VersionHashInputs> {
  const [canonical_text_sha256, raw_file_sha256] = await Promise.all([
    contentHash(args.canonicalText),
    bytesHash(args.rawBytes),
  ]);
  return {
    canonical_text_sha256,
    raw_file_sha256,
    extractor_id: args.extractorId,
    extractor_version: args.extractorVersion,
  };
}

/**
 * Fold the version-hash inputs into a single deterministic source-version hash.
 * Order-invariant by construction (fixed field order in a canonical string) so two
 * semantically identical documents cannot produce distinct hashes. This is the
 * value that flows into verdict cache keys and claim provenance.
 */
export async function sourceVersionHash(inputs: VersionHashInputs): Promise<string> {
  const canonical = [
    inputs.canonical_text_sha256,
    inputs.raw_file_sha256,
    inputs.extractor_id,
    inputs.extractor_version,
  ].join("|");
  return contentHash(canonical);
}

/** Extract the textual (offset,length) from any locator, if it carries one. */
export function locatorOffsets(
  locator: ConnectSourceLocator,
): { offset: number; length: number } | null {
  if (locator.kind === "textual") return { offset: locator.offset, length: locator.length };
  if (locator.offset !== undefined && locator.length !== undefined) {
    return { offset: locator.offset, length: locator.length };
  }
  return null;
}

export type LocatorResolution =
  | { ok: true; slice: string }
  | { ok: false; reason: "no_offsets" | "out_of_range" | "text_mismatch"; slice?: string };

/**
 * Re-resolve one unit's locator against canonical text and confirm the slice is
 * byte-identical to the unit's stored verbatim text. UTF-16 offsets -> native slice.
 */
export function reresolveLocator(
  canonicalText: string,
  unit: Pick<ConnectTextUnit, "text" | "source_locator">,
): LocatorResolution {
  const off = locatorOffsets(unit.source_locator);
  if (!off) return { ok: false, reason: "no_offsets" };
  const { offset, length } = off;
  if (offset < 0 || offset + length > canonicalText.length) {
    return { ok: false, reason: "out_of_range" };
  }
  const slice = canonicalText.slice(offset, offset + length);
  if (slice !== unit.text) return { ok: false, reason: "text_mismatch", slice };
  return { ok: true, slice };
}

export interface RoundTripReport {
  total: number;
  resolved: number;
  failures: Array<{ index: number; reason: string }>;
  ok: boolean;
}

/**
 * Round-trip the whole result: every unit that carries offsets must re-resolve
 * byte-identically. Units without offsets (a legitimately spatial-only extractor)
 * are counted but not failed -- the tier label, not this check, discloses that.
 */
export function assertProvenanceRoundTrip(result: ConnectExtractionResult): RoundTripReport {
  const canonicalText = buildCanonicalText(result.text_units);
  const failures: RoundTripReport["failures"] = [];
  let resolved = 0;
  result.text_units.forEach((unit, index) => {
    const r = reresolveLocator(canonicalText, unit);
    if (r.ok) {
      resolved += 1;
    } else if (r.reason !== "no_offsets") {
      failures.push({ index, reason: r.reason });
    }
  });
  return {
    total: result.text_units.length,
    resolved,
    failures,
    ok: failures.length === 0,
  };
}
