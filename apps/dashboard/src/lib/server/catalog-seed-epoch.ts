/**
 * Normalize catalog seed date fields to epoch ms for BIGINT columns.
 * Seed JSON may use numbers (ms) or ISO date strings (YYYY-MM-DD).
 */
export function catalogSeedEpochMs(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    const iso = trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00.000Z`;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}
