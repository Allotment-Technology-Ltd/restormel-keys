import { normalizeValidationStatus } from "$lib/connect/validation-status";

/** Visual identity for graph review verdicts — aligned with use-case accent tokens. */
export type GraphReviewVerdictId = "ok" | "weak" | "unsupported" | "unknown";

export type GraphReviewVerdictVisual = {
  id: GraphReviewVerdictId;
  label: string;
  /** Uppercase stamp shown on queue cards (scannable without reading badges). */
  stamp: string;
  rowClass: string;
  filterChipClass: string;
  breakdownClass: string;
  detailPanelClass: string;
};

export const GRAPH_REVIEW_VERDICT_VISUAL: Record<GraphReviewVerdictId, GraphReviewVerdictVisual> = {
  ok: {
    id: "ok",
    label: "Supported",
    stamp: "SUPPORTED",
    rowClass: "unit-row--verdict-ok",
    filterChipClass: "filter-chip--verdict-ok",
    breakdownClass: "vb-stat--verdict-ok",
    detailPanelClass: "review-guidance-ok",
  },
  weak: {
    id: "weak",
    label: "Weak",
    stamp: "WEAK",
    rowClass: "unit-row--verdict-weak",
    filterChipClass: "filter-chip--verdict-weak",
    breakdownClass: "vb-stat--verdict-weak",
    detailPanelClass: "review-guidance-weak",
  },
  unsupported: {
    id: "unsupported",
    label: "Unsupported",
    stamp: "UNSUPPORTED",
    rowClass: "unit-row--verdict-unsupported",
    filterChipClass: "filter-chip--verdict-unsupported",
    breakdownClass: "vb-stat--verdict-unsupported",
    detailPanelClass: "review-guidance-unsupported",
  },
  unknown: {
    id: "unknown",
    label: "Pending",
    stamp: "PENDING",
    rowClass: "unit-row--verdict-unknown",
    filterChipClass: "filter-chip--verdict-unknown",
    breakdownClass: "vb-stat--verdict-unknown",
    detailPanelClass: "review-guidance-unknown",
  },
};

export const GRAPH_REVIEW_VERDICT_LEGEND: GraphReviewVerdictId[] = ["ok", "weak", "unsupported"];

export function graphReviewVerdictId(status: string | null | undefined): GraphReviewVerdictId {
  const s = normalizeValidationStatus(status);
  if (s === "ok" || s === "weak" || s === "unsupported") return s;
  return "unknown";
}

export function graphReviewVerdictVisual(status: string | null | undefined): GraphReviewVerdictVisual {
  return GRAPH_REVIEW_VERDICT_VISUAL[graphReviewVerdictId(status)];
}
