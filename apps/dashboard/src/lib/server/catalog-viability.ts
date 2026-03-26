/**
 * Shared rules for which catalog models/variants are offered in selectors and public list APIs.
 * See docs/reference/catalog-governance.md.
 */

export const NON_VIABLE_MODEL_LIFECYCLE_STATES = new Set(["deprecated", "retired"]);

export const VIABLE_VARIANT_AVAILABILITY_STATES = new Set(["available"]);

export function normalizeCatalogToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Models with null/empty lifecycle are treated as viable (legacy rows) unless past retirement_date. */
export function isViableCatalogModelLifecycle(lifecycleState: string | null): boolean {
  const n = normalizeCatalogToken(lifecycleState);
  if (!n) return true;
  return !NON_VIABLE_MODEL_LIFECYCLE_STATES.has(n);
}

export function isPastCatalogRetirement(retirementDateMs: number | null, nowMs: number): boolean {
  return retirementDateMs != null && retirementDateMs <= nowMs;
}

export function isViableCatalogModel(
  m: { lifecycleState: string | null; retirementDate: number | null },
  nowMs: number = Date.now()
): boolean {
  if (!isViableCatalogModelLifecycle(m.lifecycleState)) return false;
  if (isPastCatalogRetirement(m.retirementDate, nowMs)) return false;
  return true;
}

export function isViableCatalogVariantAvailability(availabilityStatus: string | null): boolean {
  return VIABLE_VARIANT_AVAILABILITY_STATES.has(normalizeCatalogToken(availabilityStatus));
}

export function epochMsToIsoOrNull(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}
