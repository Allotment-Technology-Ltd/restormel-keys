/**
 * K5 — request-log traffic-source tagging.
 *
 * Connect ingest resolves server-side and never hit the HTTP resolve endpoint, so
 * its traffic was invisible in Keys Logs/Usage (BP-12). K5 writes a request-log row
 * per ingest resolve tagged `source=connect_ingest`. The tag lives in the existing
 * `request_logs.metadata` JSONB column (migration 004) — no new column/migration —
 * so /logs (and W3.3's filter UX) can surface Connect traffic.
 */

/** Fold an explicit source tag into a metadata blob (source wins; null when neither). */
export function requestLogMetadataWithSource(
  metadata: Record<string, unknown> | null | undefined,
  source: string | null | undefined,
): Record<string, unknown> | null {
  if (source != null && source !== "") {
    return { ...(metadata ?? {}), source };
  }
  return metadata ?? null;
}

/** Read `metadata.source` from a request-log row's JSONB (parsed object or raw string). */
export function requestLogSourceFromMetadata(raw: unknown): string | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const src = (obj as Record<string, unknown>).source;
  return typeof src === "string" && src.trim() ? src.trim() : null;
}

/**
 * W3.3 — parse a request-log row's `metadata` JSONB into a plain object for the /logs
 * receipt. The neon driver usually returns JSONB pre-parsed, but it can also hand back
 * a raw string; this tolerates both and returns null for empty/non-object metadata.
 */
export function parseRequestLogMetadata(raw: unknown): Record<string, unknown> | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return null;
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  return obj as Record<string, unknown>;
}
