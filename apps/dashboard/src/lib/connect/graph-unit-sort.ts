import {
  isUncheckedValidationStatus,
  normalizeValidationStatus,
} from "$lib/connect/validation-status";

function reviewPriority(status: string | null | undefined): number {
  const s = normalizeValidationStatus(status);
  if (s === "unsupported") return 0;
  if (s === "weak") return 1;
  if (isUncheckedValidationStatus(status)) return 2;
  if (s === "ok") return 3;
  return 2;
}

export type GraphUnitSortable = {
  text: string;
  validationStatus: string | null;
};

/** Shared triage ordering for graph explorer (server SSR + client load-more). */
export function sortGraphUnitsForReview<T extends GraphUnitSortable>(units: T[]): T[] {
  return [...units].sort((a, b) => {
    const p = reviewPriority(a.validationStatus) - reviewPriority(b.validationStatus);
    if (p !== 0) return p;
    return a.text.localeCompare(b.text);
  });
}
