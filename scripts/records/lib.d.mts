// Type declarations for lib.mjs (the records front-matter parser).
// This is ONLY types — the implementation stays in lib.mjs so consumers (the Drive
// mirror, the governance scripts, and the dashboard publish gate) all reuse one parser.

/** Parse flat `key: value` (+ inline `[a, b]` lists) YAML front-matter. Returns null if absent. */
export function parseFrontMatter(
  content: string,
): Record<string, string | string[]> | null;

/** Add an ISO-8601 duration (e.g. P12M) to a YYYY-MM-DD date. */
export function addISODuration(dateStr: string, dur: string): string | null;

/** Whole-number days until a YYYY-MM-DD date (negative = past). */
export function daysUntil(dateStr: string): number | null;

/** POSIX-relative path from the repo root. */
export function relPosix(fp: string): string;

/** Record-bearing roots walked by the governance tooling. */
export const RECORD_ROOTS: string[];

/** `RECORDS_ENFORCE=1` → checks are blocking. */
export const ENFORCE: boolean;
