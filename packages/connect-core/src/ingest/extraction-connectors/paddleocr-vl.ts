/**
 * PaddleOCR-VL extraction connector — the MANAGED DEFAULT (Tier A, spatial).
 *
 * REC-GOV-022 verdict line: "PaddleOCR-VL / PaddleOCR-VL-1.5 (0.9B) | Apache-2.0
 * (HF LICENSE file; arXiv 2510.14528 / 2601.21957) | Commercial: Yes | Service-to-3P:
 * Yes | Verdict: CLEARED." Best VALUE + self-host, emits bounding boxes for span
 * provenance. Wired AT RISK per D-2026-07-02-1 (recommended/provisionally-CLEARED
 * set; trial phase, no external users; rollback is the mitigation).
 *
 * PaddleOCR-VL self-hosts as a model server (layout model PP-DocLayoutV2 + the 0.9B
 * VL recognizer). connect-core stays credential-free and GPU-free: the HTTP call to
 * that server is an INJECTED transport (a `fetch`-shaped function), so (a) the real
 * wiring lives in the host app, (b) this adapter is unit-testable with a fixture
 * double, and (c) excising it is `git rm` of this dir + its config entry — no spine
 * edit, no `process.env` read here. The transport contract below is the exact
 * PaddleOCR-VL server response shape (page-relative pixel bboxes + per-block score),
 * mapped into the neutral Restormel contract so no vendor shape is persisted.
 *
 * Honesty note: with no GPU/weights in this environment, `extract()` has been run
 * only against the fixture double. A live run needs a PaddleOCR-VL server endpoint;
 * the mapping code below is the real integration, exercised end-to-end by the
 * conformance suite against that double.
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

/** The PaddleOCR-VL server response shape (pure layout+OCR; no LLM reshaping). */
export interface PaddleOcrVlResponse {
  pages: Array<{
    page_index: number;
    width: number; // page pixel width, for bbox normalization
    height: number;
    blocks: Array<{
      /** Verbatim recognized text for the block. */
      text: string;
      /** Pixel bbox [x0,y0,x1,y1] in page coordinates. */
      bbox: [number, number, number, number];
      /** Recognition confidence in [0,1]. */
      score: number;
      /** PP-DocLayoutV2 element label. */
      label?: string;
      /** Reading-order rank within the document. */
      order?: number;
    }>;
  }>;
  language?: string;
}

/** A `fetch`-shaped transport the host injects; keeps connect-core network-free. */
export type PaddleOcrVlTransport = (
  input: ExtractionSourceDocument,
) => Promise<PaddleOcrVlResponse>;

const LABEL_TO_BLOCK: Record<string, ConnectBlockType> = {
  title: "title",
  header: "heading",
  heading: "heading",
  text: "paragraph",
  paragraph: "paragraph",
  list: "list_item",
  list_item: "list_item",
  table: "table",
  table_cell: "table_cell",
  figure_caption: "caption",
  caption: "caption",
  footnote: "footnote",
  code: "code",
};

function mapBlockType(label?: string): ConnectBlockType | undefined {
  if (!label) return undefined;
  return LABEL_TO_BLOCK[label.toLowerCase()] ?? "other";
}

/** Clamp a normalized coordinate into [0,1] (defensive against off-by-one bboxes). */
function norm(value: number, extent: number): number {
  if (extent <= 0) return 0;
  const v = value / extent;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export class PaddleOcrVlExtractionConnector implements ExtractionConnector {
  readonly id = "paddleocr-vl" as const;
  readonly version = "1.5.0";
  readonly declaredTier = "spatial" as const;

  constructor(private readonly transport: PaddleOcrVlTransport) {}

  async extract(input: ExtractionSourceDocument): Promise<ConnectExtractionResult> {
    if (input.bytes.length === 0) {
      throw new ExtractionError("empty_source", this.id, "Source has zero bytes.");
    }

    let res: PaddleOcrVlResponse;
    try {
      res = await this.transport(input);
    } catch (err) {
      throw new ExtractionError(
        "transport_failed",
        this.id,
        `PaddleOCR-VL transport failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res || !Array.isArray(res.pages)) {
      throw new ExtractionError("malformed_response", this.id, "PaddleOCR-VL response had no pages array.");
    }

    // Flatten blocks in reading order, assigning canonical-text offsets as we go.
    const text_units: ConnectTextUnit[] = [];
    let cursor = 0;
    let order = 0;
    for (const page of res.pages) {
      if (!Array.isArray(page.blocks)) continue;
      const blocks = [...page.blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      for (const block of blocks) {
        const text = typeof block.text === "string" ? block.text : "";
        if (!text) continue; // skip empty recognitions; never fabricate text
        const [x0, y0, x1, y1] = block.bbox ?? [0, 0, 0, 0];
        const offset = cursor;
        text_units.push({
          text, // VERBATIM — no reshaping
          source_locator: {
            kind: "spatial",
            page: page.page_index,
            bbox: {
              x0: norm(x0, page.width),
              y0: norm(y0, page.height),
              x1: norm(x1, page.width),
              y1: norm(y1, page.height),
            },
            offset,
            length: text.length,
          },
          confidence: typeof block.score === "number" ? Math.max(0, Math.min(1, block.score)) : 1,
          block_type: mapBlockType(block.label),
          reading_order: block.order ?? order,
        });
        cursor += text.length + 1; // + "\n" join
        order += 1;
      }
    }

    if (text_units.length === 0) {
      throw new ExtractionError("malformed_response", this.id, "PaddleOCR-VL returned no text blocks.");
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

export function createPaddleOcrVlConnector(transport: PaddleOcrVlTransport): ExtractionConnector {
  return new PaddleOcrVlExtractionConnector(transport);
}
