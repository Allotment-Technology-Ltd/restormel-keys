/**
 * Mistral OCR extraction connector — the CURATED ALTERNATIVE (Tier A, spatial),
 * API-ONLY, PURE-EXTRACTION MODE ONLY.
 *
 * REC-GOV-022 verdict lines:
 *   "Mistral OCR (OCR 3 / OCR 4) — API | Proprietary Premier model under Mistral
 *    commercial API ToS | CLEARED (API) — verify."
 *   "Mistral OCR — self-host/on-prem | ... NOT Apache-2.0 | NEEDS COMMERCIAL LICENCE."
 * Therefore this adapter calls the HOSTED API only; there is no weight download,
 * no self-host path, anywhere in this file or its manifests. Wired AT RISK per
 * D-2026-07-02-1 (recommended/provisionally-CLEARED set; API pure-extraction only).
 *
 * PURE-EXTRACTION guardrail (REC-TECH-014, verification-engineering §2 "verbatim
 * text, always"): we use the OCR endpoint that returns recognized text + bboxes +
 * confidence. We do NOT use the Document-AI / structured-schema tier, which pipes
 * output through an LLM to reshape it — ungrounded transformation upstream of
 * verification. `document.text` is stored verbatim.
 *
 * connect-core stays credential-free: the actual HTTPS call + MISTRAL_API_KEY live
 * in the host app's injected transport. This adapter reads no `process.env`, holds
 * no key, and is fixture-testable without a credential. Excise = `git rm` this dir +
 * config entry + the ADAPTER_MISTRAL_API_KEY secret.
 */
import type {
  ConnectExtractionResult,
  ConnectTextUnit,
  ConnectBlockType,
} from "@restormel/contracts/connect";
import {
  CANONICAL_OFFSET_UNIT,
  ExtractionError,
  deriveCapabilityTier,
  type ExtractionConnector,
  type ExtractionSourceDocument,
} from "../extraction-connector.js";
import { computeVersionHashInputs } from "../extraction-provenance.js";

/**
 * The Mistral OCR API response shape in PURE-EXTRACTION mode: pages of blocks with
 * verbatim text, normalized bboxes ([0,1] page-relative), and per-block confidence.
 * (No `document_annotation` / schema fields — those belong to the Document-AI tier
 * we deliberately do not call.)
 */
export interface MistralOcrResponse {
  pages: Array<{
    index: number;
    blocks: Array<{
      text: string;
      /** Normalized bbox, page-relative [0,1]: {x0,y0,x1,y1}. */
      bbox: { x0: number; y0: number; x1: number; y1: number };
      confidence?: number;
      type?: string;
    }>;
  }>;
  model?: string;
  language?: string;
}

/** Host-injected transport (owns the API key + endpoint); keeps core credential-free. */
export type MistralOcrTransport = (input: ExtractionSourceDocument) => Promise<MistralOcrResponse>;

const TYPE_TO_BLOCK: Record<string, ConnectBlockType> = {
  title: "title",
  section_header: "heading",
  heading: "heading",
  text: "paragraph",
  paragraph: "paragraph",
  list_item: "list_item",
  table: "table",
  caption: "caption",
  footnote: "footnote",
  code: "code",
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export class MistralOcrExtractionConnector implements ExtractionConnector {
  readonly id = "mistral-ocr" as const;
  readonly version = "ocr-4";
  readonly declaredTier = "spatial" as const;

  constructor(private readonly transport: MistralOcrTransport) {}

  async extract(input: ExtractionSourceDocument): Promise<ConnectExtractionResult> {
    if (input.bytes.length === 0) {
      throw new ExtractionError("empty_source", this.id, "Source has zero bytes.");
    }

    let res: MistralOcrResponse;
    try {
      res = await this.transport(input);
    } catch (err) {
      throw new ExtractionError(
        "transport_failed",
        this.id,
        `Mistral OCR transport failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res || !Array.isArray(res.pages)) {
      throw new ExtractionError("malformed_response", this.id, "Mistral OCR response had no pages array.");
    }

    const text_units: ConnectTextUnit[] = [];
    let cursor = 0;
    let order = 0;
    for (const page of res.pages) {
      if (!Array.isArray(page.blocks)) continue;
      for (const block of page.blocks) {
        const text = typeof block.text === "string" ? block.text : "";
        if (!text) continue;
        const bb = block.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
        const offset = cursor;
        text_units.push({
          text, // VERBATIM
          source_locator: {
            kind: "spatial",
            page: page.index,
            bbox: {
              x0: clamp01(bb.x0),
              y0: clamp01(bb.y0),
              x1: clamp01(bb.x1),
              y1: clamp01(bb.y1),
            },
            offset,
            length: text.length,
          },
          confidence:
            typeof block.confidence === "number" ? clamp01(block.confidence) : 1,
          block_type: block.type ? TYPE_TO_BLOCK[block.type.toLowerCase()] ?? "other" : undefined,
          reading_order: order,
        });
        cursor += text.length + 1;
        order += 1;
      }
    }

    if (text_units.length === 0) {
      throw new ExtractionError("malformed_response", this.id, "Mistral OCR returned no text blocks.");
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
        language: res.language,
        page_count: res.pages.length,
        capability_tier: deriveCapabilityTier(text_units.map((u) => u.source_locator)),
        offset_unit: CANONICAL_OFFSET_UNIT,
      },
      text_units,
    };
  }
}

export function createMistralOcrConnector(transport: MistralOcrTransport): ExtractionConnector {
  return new MistralOcrExtractionConnector(transport);
}
