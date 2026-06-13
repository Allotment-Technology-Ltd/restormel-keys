/**
 * Tolerant, shape-aware extraction of bibliographic source fields from arbitrary
 * BYO graph rows.
 *
 * External / Bring-Your-Own SurrealDB graphs name their fields however they like:
 * the URL might be `canonical_url`, the kind might be `source_type`, authors might
 * be an array of strings or an array of `{ name }` objects. The previous code read
 * only `row.url`, `row.kind ?? row.source_kind`, and assumed every field was a
 * string — so a perfectly valid `source` table with `canonical_url` / `source_type`
 * / `author[]` produced null title/url/kind and, downstream, false "no sources".
 *
 * These helpers resolve identity fields across a BROAD set of name synonyms and
 * coerce array/object values defensively. They never throw and never require an
 * exact field name.
 */

/** URL-bearing field names, in priority order. `canonical_url` is common in BYO graphs. */
export const SOURCE_URL_FIELD_KEYS = [
  "url",
  "canonical_url",
  "canonicalUrl",
  "source_url",
  "sourceUrl",
  "link",
  "uri",
  "href",
  "permalink",
] as const;

/** Kind/type field names, in priority order. `source_type` is common in BYO graphs. */
export const SOURCE_KIND_FIELD_KEYS = [
  "kind",
  "source_kind",
  "source_type",
  "sourceType",
  "type",
  "doc_type",
  "category",
] as const;

/** Title/name field names, in priority order. */
export const SOURCE_TITLE_FIELD_KEYS = [
  "title",
  "name",
  "headline",
  "label",
  "heading",
] as const;

type Row = Record<string, unknown>;

/** First field whose value is a non-empty trimmed string, scanning `keys` in order. */
function firstNonEmptyString(row: Row | null | undefined, keys: readonly string[]): string | null {
  if (!row || typeof row !== "object") return null;
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

/** Resolve a source URL across `url`, `canonical_url`, `source_url`, `link`, etc. */
export function extractSourceUrl(row: Row | null | undefined): string | null {
  return firstNonEmptyString(row, SOURCE_URL_FIELD_KEYS);
}

/** Resolve a source kind across `kind`, `source_kind`, `source_type`, `type`, etc. */
export function extractSourceKind(row: Row | null | undefined): string | null {
  return firstNonEmptyString(row, SOURCE_KIND_FIELD_KEYS);
}

/** Resolve a source title across `title`, `name`, `headline`, `label`, etc. */
export function extractSourceTitle(row: Row | null | undefined): string | null {
  return firstNonEmptyString(row, SOURCE_TITLE_FIELD_KEYS);
}

/** Object author shapes carry the display name under one of these keys. */
const AUTHOR_NAME_KEYS = ["name", "full_name", "fullName", "label", "display_name", "displayName"] as const;

function authorEntryToString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Row;
    for (const key of AUTHOR_NAME_KEYS) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

/**
 * Coerce an author field (string, string[], array of `{ name }` objects, or null)
 * to a single display string. Arrays are joined with ", ". Never throws on
 * arrays/objects; returns null when nothing usable is present.
 */
export function normalizeAuthor(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => authorEntryToString(entry))
      .filter((s): s is string => Boolean(s));
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    return authorEntryToString(value);
  }
  return null;
}

/**
 * Defensively coerce any field value to a display string for use as a fallback
 * title or label. Handles string, number, string[] (joined with ", "), and
 * `{ name }`-shaped objects. Never throws; returns null when nothing usable.
 */
export function coerceScalarField(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (typeof entry === "number" && Number.isFinite(entry)) return String(entry);
        return authorEntryToString(entry) ?? "";
      })
      .filter((s) => Boolean(s));
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    return authorEntryToString(value);
  }
  return null;
}
