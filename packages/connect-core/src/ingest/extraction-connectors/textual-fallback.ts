/**
 * Textual-fallback extraction connector — the Tier-B path (REC-TECH-014 §Scope 3,
 * graceful degradation). Dependency-free, deterministic, always available: it reads
 * text-like bytes and emits offset-only (`textual`) locators with NO bounding boxes.
 * Its whole job is to prove the contract degrades honestly — a thin component yields
 * lower-fidelity provenance, transparently labelled Tier B, never faked as Tier A.
 *
 * This is NOT a vendor component: no licence gate applies, no credentials, no network.
 * It is the honest floor beneath the managed default and the curated alternative.
 *
 * Offsets index the canonical text (units joined by "\n" — see
 * extraction-provenance.buildCanonicalText), in UTF-16 units (declared offset_unit).
 * Blocks split on blank lines; confidence is a fixed 1.0 because the mapping is
 * mechanical and exact (there is no OCR uncertainty in a text decode).
 */
import type { ConnectExtractionResult, ConnectTextUnit } from "@restormel/contracts/connect";
import {
  CANONICAL_OFFSET_UNIT,
  ExtractionError,
  deriveCapabilityTier,
  type ExtractionConnector,
  type ExtractionSourceDocument,
} from "../extraction-connector.js";
import { computeVersionHashInputs } from "../extraction-provenance.js";

const TEXT_MIME = /^(text\/|application\/(json|xml|x-ndjson|csv)|application\/xhtml\+xml)/i;

function decode(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

/** Classify a block by its leading marker (best-effort structural hint). */
function classifyBlock(block: string): ConnectTextUnit["block_type"] {
  if (/^#{1,6}\s+/.test(block)) return "heading";
  if (/^[-*]\s+/.test(block)) return "list_item";
  if (/^\|.*\|$/m.test(block)) return "table";
  return "paragraph";
}

export class TextualFallbackExtractionConnector implements ExtractionConnector {
  readonly id = "textual-fallback" as const;
  readonly version = "1.0.0";
  readonly declaredTier = "textual" as const;

  supports(mime: string): boolean {
    return TEXT_MIME.test(mime ?? "");
  }

  async extract(input: ExtractionSourceDocument): Promise<ConnectExtractionResult> {
    if (input.bytes.length === 0) {
      throw new ExtractionError("empty_source", this.id, "Source has zero bytes.");
    }
    const mime = (input.mime ?? "").toLowerCase();
    if (mime && !this.supports(mime)) {
      throw new ExtractionError(
        "unsupported_mime",
        this.id,
        `Textual fallback cannot read "${mime}"; use a spatial connector for binary formats.`,
      );
    }
    const raw = decode(input.bytes);
    // Blocks separated by blank lines; keep verbatim text (no trim of the text itself
    // beyond block segmentation) so offsets into the joined canonical text are exact.
    const blocks = raw.split(/\n{2,}/).map((b) => b.replace(/^\n+|\n+$/g, "")).filter((b) => b.length > 0);

    const text_units: ConnectTextUnit[] = [];
    let cursor = 0; // offset into the canonical text (units joined by "\n")
    blocks.forEach((block, i) => {
      const offset = cursor;
      text_units.push({
        text: block,
        source_locator: { kind: "textual", offset, length: block.length },
        confidence: 1,
        block_type: classifyBlock(block),
        reading_order: i,
      });
      // Advance past this unit + the "\n" join that buildCanonicalText inserts.
      cursor += block.length + 1;
    });

    if (text_units.length === 0) {
      throw new ExtractionError("empty_source", this.id, "No text blocks found in source.");
    }

    const canonicalText = text_units.map((u) => u.text).join("\n");
    const version_hash_inputs = await computeVersionHashInputs({
      canonicalText,
      rawBytes: input.bytes,
      extractorId: this.id,
      extractorVersion: this.version,
    });

    return {
      document: {
        source_id: input.sourceId,
        version_hash_inputs,
        capability_tier: deriveCapabilityTier(text_units.map((u) => u.source_locator)),
        offset_unit: CANONICAL_OFFSET_UNIT,
        page_count: undefined,
      },
      text_units,
    };
  }
}

export const textualFallbackExtractionConnector = new TextualFallbackExtractionConnector();
