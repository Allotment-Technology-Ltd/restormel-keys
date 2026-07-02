/**
 * Fixture doubles for the extraction spike. These stand in for the PaddleOCR-VL
 * model server and the Mistral OCR API so connect-core is testable with NO GPU and
 * NO credential. They are contract-conformance doubles: each returns the exact
 * vendor response SHAPE the real transport would, so the adapter's mapping code is
 * exercised end-to-end. They are NOT a live run — every report built from them is
 * stamped `execution: "fixture"` (see extraction-validation-harness).
 *
 * Small, indicative documents shaped like legal / pharma / finance content (complex
 * layout hints: headings, tables, footnotes). Committed as source strings + a
 * builder, not huge binaries (REC-TECH-014: "commit small fixture documents").
 */
import type { ExtractionSourceDocument } from "../extraction-connector.js";
import type { PaddleOcrVlResponse } from "../extraction-connectors/paddleocr-vl.js";
import type { MistralOcrResponse } from "../extraction-connectors/mistral-ocr.js";

/** Blocks shared across fixtures so the two OCR doubles and the text fixture agree. */
export interface FixtureBlock {
  text: string;
  label: string;
  page: number;
  /** Pixel bbox for PaddleOCR-VL (page is 1000x1400). */
  pixelBBox: [number, number, number, number];
  /** Normalized bbox for Mistral OCR. */
  normBBox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export interface ExtractionFixture {
  sourceId: string;
  docType: "legal" | "pharma" | "finance";
  mime: string;
  name: string;
  blocks: FixtureBlock[];
  language: string;
}

const PAGE_W = 1000;
const PAGE_H = 1400;

function block(
  text: string,
  label: string,
  page: number,
  px: [number, number, number, number],
  confidence: number,
): FixtureBlock {
  return {
    text,
    label,
    page,
    pixelBBox: px,
    normBBox: { x0: px[0] / PAGE_W, y0: px[1] / PAGE_H, x1: px[2] / PAGE_W, y1: px[3] / PAGE_H },
    confidence,
  };
}

/** Three small, indicative fixtures with complex-layout shapes. */
export const EXTRACTION_FIXTURES: ExtractionFixture[] = [
  {
    sourceId: "fixture-legal-001",
    docType: "legal",
    mime: "application/pdf",
    name: "master-services-agreement.pdf",
    language: "en",
    blocks: [
      block("MASTER SERVICES AGREEMENT", "title", 0, [120, 80, 880, 130], 0.99),
      block(
        "This Master Services Agreement (the “Agreement”) is entered into as of the Effective Date by and between the parties identified in Schedule A.",
        "text",
        0,
        [120, 160, 880, 240],
        0.97,
      ),
      block(
        "1. LIMITATION OF LIABILITY. In no event shall either party's aggregate liability exceed the fees paid in the twelve (12) months preceding the claim.",
        "text",
        0,
        [120, 260, 880, 360],
        0.94,
      ),
      block("Indemnifying Party | Cap | Carve-out", "table", 1, [120, 120, 880, 160], 0.88),
      block("* Fraud and wilful misconduct are excluded from the cap above.", "footnote", 1, [120, 1300, 880, 1340], 0.72),
    ],
  },
  {
    sourceId: "fixture-pharma-001",
    docType: "pharma",
    mime: "application/pdf",
    name: "clinical-study-report.pdf",
    language: "en",
    blocks: [
      block("Clinical Study Report: Phase III Efficacy", "title", 0, [100, 70, 900, 120], 0.99),
      block(
        "The primary endpoint was the change from baseline in HbA1c at Week 24 in the intent-to-treat population.",
        "text",
        0,
        [100, 150, 900, 230],
        0.96,
      ),
      block(
        "Adverse events were reported in 12.4% of the treatment arm versus 9.1% of placebo (p = 0.03).",
        "text",
        0,
        [100, 250, 900, 330],
        0.91,
      ),
      block("Arm | n | AE % | 95% CI", "table", 1, [100, 110, 900, 150], 0.85),
    ],
  },
  {
    sourceId: "fixture-finance-001",
    docType: "finance",
    mime: "application/pdf",
    name: "annual-report-extract.pdf",
    language: "en",
    blocks: [
      block("Consolidated Statement of Operations", "title", 0, [110, 90, 890, 140], 0.99),
      block(
        "Total revenue for the fiscal year was $4,218.6 million, an increase of 17% compared with the prior year.",
        "text",
        0,
        [110, 170, 890, 250],
        0.95,
      ),
      block(
        "Operating margin declined to 22.3% from 24.1%, primarily due to increased research and development expense.",
        "text",
        0,
        [110, 270, 890, 350],
        0.9,
      ),
      block("Line item | FY2025 | FY2024", "table", 1, [110, 120, 890, 160], 0.83),
    ],
  },
];

/** The plain-text form of a fixture (for the textual-fallback connector). */
export function fixtureAsText(fixture: ExtractionFixture): ExtractionSourceDocument {
  const text = fixture.blocks.map((b) => b.text).join("\n\n");
  return {
    sourceId: fixture.sourceId,
    bytes: new TextEncoder().encode(text),
    mime: "text/plain",
    name: fixture.name.replace(/\.pdf$/, ".txt"),
  };
}

/** The binary-source form of a fixture (bytes go to the OCR transport doubles). */
export function fixtureAsBinary(fixture: ExtractionFixture): ExtractionSourceDocument {
  // Deterministic pseudo-bytes derived from the text so raw_file_sha256 is stable.
  const text = fixture.blocks.map((b) => b.text).join("\n\n");
  return {
    sourceId: fixture.sourceId,
    bytes: new TextEncoder().encode(`%PDF-1.7\n${text}`),
    mime: fixture.mime,
    name: fixture.name,
  };
}

/** PaddleOCR-VL server double: returns the fixture as the real server would. */
export function makePaddleOcrVlFixtureTransport(fixture: ExtractionFixture) {
  return async (): Promise<PaddleOcrVlResponse> => {
    const pageIndices = [...new Set(fixture.blocks.map((b) => b.page))].sort();
    return {
      language: fixture.language,
      pages: pageIndices.map((pageIndex) => ({
        page_index: pageIndex,
        width: PAGE_W,
        height: PAGE_H,
        blocks: fixture.blocks
          .filter((b) => b.page === pageIndex)
          .map((b, i) => ({
            text: b.text,
            bbox: b.pixelBBox,
            score: b.confidence,
            label: b.label,
            order: fixture.blocks.indexOf(b),
          })),
      })),
    };
  };
}

/** Mistral OCR API double (pure-extraction shape). */
export function makeMistralOcrFixtureTransport(fixture: ExtractionFixture) {
  return async (): Promise<MistralOcrResponse> => {
    const pageIndices = [...new Set(fixture.blocks.map((b) => b.page))].sort();
    return {
      model: "mistral-ocr-4",
      language: fixture.language,
      pages: pageIndices.map((index) => ({
        index,
        blocks: fixture.blocks
          .filter((b) => b.page === index)
          .map((b) => ({
            text: b.text,
            bbox: b.normBBox,
            confidence: b.confidence,
            type: b.label,
          })),
      })),
    };
  };
}

/** Required-sentence fidelity checks per fixture (binary extractor eval). */
export function fixtureMustContain(fixture: ExtractionFixture): string[] {
  // Use the two most content-bearing narrative blocks as the fidelity anchors.
  return fixture.blocks.filter((b) => b.label === "text").map((b) => b.text);
}
