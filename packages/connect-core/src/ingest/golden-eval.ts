export type GoldenExtractionEvalItem = {
  url: string;
  source_type?: string;
  why?: string;
};

export type GoldenExtractionEvalFile = {
  version: number;
  description?: string;
  default_source_type?: string;
  items: GoldenExtractionEvalItem[];
  web_article_placeholders?: string[];
};

/** G2 quality targets from CONNECT-INGEST-QUALITY-BAR. */
export const G2_OK_PCT_TARGET = 90;
export const G2_UNSUPPORTED_PCT_MAX = 2;

export type G2QualityMetrics = {
  ok: number;
  weak: number;
  unsupported: number;
  ok_pct: number;
  unsupported_pct: number;
};

export function computeG2Metrics(counts: {
  ok: number;
  weak: number;
  unsupported: number;
}): G2QualityMetrics {
  const denom = counts.ok + counts.weak + counts.unsupported;
  const ok_pct = denom > 0 ? Math.round((counts.ok / denom) * 100) : 0;
  const unsupported_pct = denom > 0 ? Math.round((counts.unsupported / denom) * 100) : 0;
  return { ...counts, ok_pct, unsupported_pct };
}

export function assertG2Targets(metrics: G2QualityMetrics): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (metrics.ok_pct < G2_OK_PCT_TARGET) {
    reasons.push(`ok_pct ${metrics.ok_pct}% < ${G2_OK_PCT_TARGET}%`);
  }
  if (metrics.unsupported_pct > G2_UNSUPPORTED_PCT_MAX) {
    reasons.push(`unsupported_pct ${metrics.unsupported_pct}% > ${G2_UNSUPPORTED_PCT_MAX}%`);
  }
  return { pass: reasons.length === 0, reasons };
}

/** Bundled starter fixture — philosophy pack smoke URLs (G7 regression). */
export const PHILOSOPHY_STARTER_GOLDEN: GoldenExtractionEvalFile = {
  version: 1,
  description: "Starter golden URLs for philosophy pack regression (Connect quality programme G7).",
  default_source_type: "web_article",
  items: [
    {
      url: "https://plato.stanford.edu/entries/utilitarianism-history/",
      source_type: "web_article",
      why: "Structured SEP article — argument mining smoke test",
    },
    {
      url: "https://plato.stanford.edu/entries/consequentialism/",
      source_type: "web_article",
      why: "Relation density and domain vocabulary",
    },
  ],
};

export function loadGoldenExtractionEval(
  fixture: GoldenExtractionEvalFile = PHILOSOPHY_STARTER_GOLDEN,
): GoldenExtractionEvalFile {
  return fixture;
}

/** Stable fingerprint for CI cache keys and pack-change detection (no node:crypto — safe if barrel-imported on client). */
export function goldenExtractionEvalFingerprint(items: GoldenExtractionEvalItem[]): string {
  const lines = items
    .map((i) => `${i.source_type ?? "web_article"}|${i.url.trim()}`)
    .sort()
    .join("\n");
  let h = 2166136261;
  for (let i = 0; i < lines.length; i++) {
    h ^= lines.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(16, "0").slice(0, 16);
}
