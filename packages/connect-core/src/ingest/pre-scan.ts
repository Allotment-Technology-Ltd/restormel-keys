/**
 * Deterministic pre-scan gate before LLM spend (ported from SOPHIA pre-scan Layer A).
 * No network calls when text is already available; optional URL HEAD for url sources.
 */

export type PreScanBlocker = "pdf_binary" | "empty" | "cost_ceiling" | "unreachable";

export type PreScanInput = {
  name: string;
  mime?: string;
  /** UTF-8 text when already fetched/parsed. */
  text?: string;
  url?: string;
  /** Estimated USD for a full production ingest (caller or heuristic). */
  estimatedCostUsd?: number;
  costCeilingUsd?: number;
};

export type PreScanResult = {
  blockers: PreScanBlocker[];
  warnings: string[];
  estimatedTokens: number;
  sectionCount: number;
  maxSectionTokens: number;
  estimatedCostUsd: number;
  suggestsParserTier: "builtin" | "managed" | null;
};

const LARGE_SOURCE_TOKENS = 100_000;
const MANY_SECTIONS = 20;
const MAX_SECTION_TOKENS = 10_000;
const WARN_SECTION_FACTOR = 1.5;
const DEFAULT_COST_CEILING = 2.0;
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

function splitSectionCount(text: string): { count: number; maxSectionTokens: number } {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  if (paragraphs.length === 0) return { count: 1, maxSectionTokens: estimateTokens(text) };
  let max = 0;
  for (const p of paragraphs) {
    max = Math.max(max, estimateTokens(p));
  }
  return { count: paragraphs.length, maxSectionTokens: max };
}

function heuristicCostUsd(totalTokens: number, sectionCount: number): number {
  const inputTokens = sectionCount * (2000 + Math.ceil(totalTokens / Math.max(1, sectionCount)));
  const claims = Math.ceil((totalTokens / 1000) * 10);
  const outputTokens = claims * 100;
  const claudeUsd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
  const embedUsd = (claims * 300 / 1_000_000) * 0.12;
  return claudeUsd + embedUsd + 0.05;
}

function isPdfMime(mime?: string): boolean {
  if (!mime) return false;
  return mime.toLowerCase().includes("pdf");
}

function isPdfMagic(text: string): boolean {
  return text.trimStart().startsWith("%PDF");
}

export function runSourcePreScan(input: PreScanInput): PreScanResult {
  const warnings: string[] = [];
  const blockers: PreScanBlocker[] = [];
  const text = input.text?.trim() ?? "";
  const ceiling = input.costCeilingUsd ?? DEFAULT_COST_CEILING;

  if (isPdfMime(input.mime) || (text && isPdfMagic(text))) {
    blockers.push("pdf_binary");
    warnings.push("PDF or binary document — use a managed parser (LlamaParse, Mistral OCR, Unstructured) via Connections.");
  }

  if (!text && !input.url) {
    blockers.push("empty");
  }

  const estimatedTokens = text ? estimateTokens(text) : 0;
  const { count: sectionCount, maxSectionTokens } = text
    ? splitSectionCount(text)
    : { count: 0, maxSectionTokens: 0 };

  if (estimatedTokens > LARGE_SOURCE_TOKENS) {
    warnings.push(`Large source (~${estimatedTokens.toLocaleString()} tokens) — consider splitting or Starter preset for a trial.`);
  }
  if (sectionCount > MANY_SECTIONS) {
    warnings.push(`${sectionCount} sections detected — ingest may take multiple LLM passes.`);
  }
  if (maxSectionTokens > MAX_SECTION_TOKENS * WARN_SECTION_FACTOR) {
    warnings.push(`Largest section ~${maxSectionTokens} tokens exceeds comfortable chunk size.`);
  }

  const estimatedCostUsd =
    input.estimatedCostUsd ?? (text ? heuristicCostUsd(estimatedTokens, Math.max(1, sectionCount)) : 0);

  if (estimatedCostUsd > ceiling) {
    blockers.push("cost_ceiling");
    warnings.push(`Estimated cost ~$${estimatedCostUsd.toFixed(2)} exceeds ceiling $${ceiling.toFixed(2)}.`);
  }

  let suggestsParserTier: PreScanResult["suggestsParserTier"] = null;
  if (blockers.includes("pdf_binary")) {
    suggestsParserTier = "managed";
  } else if (text && estimatedTokens > 0) {
    suggestsParserTier = "builtin";
  }

  return {
    blockers,
    warnings,
    estimatedTokens,
    sectionCount,
    maxSectionTokens,
    estimatedCostUsd,
    suggestsParserTier,
  };
}
