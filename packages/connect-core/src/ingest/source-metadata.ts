/**
 * Lightweight HTML metadata extraction for source pre-check (no full parse).
 */
export type SourceMetadata = {
  title: string | null;
  canonical_url: string | null;
  url: string | null;
  authors: string[];
  description: string | null;
  site_name: string | null;
  published_at: string | null;
};

const META_CONTENT_RE =
  /<meta\s+[^>]*(?:property|name)\s*=\s*["']([^"']+)["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/gi;
const META_CONTENT_RE_ALT =
  /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*(?:property|name)\s*=\s*["']([^"']+)["'][^>]*>/gi;
const LINK_CANONICAL_RE =
  /<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i;
const LINK_CANONICAL_RE_ALT =
  /<link\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']canonical["'][^>]*>/i;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const H1_RE = /<h1[^>]*>([\s\S]*?)<\/h1>/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ""));
}

function readMetaMap(html: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const re of [META_CONTENT_RE, META_CONTENT_RE_ALT]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const key = m[1].toLowerCase();
      const val = decodeEntities(m[2]);
      if (key && val && !map.has(key)) map.set(key, val);
    }
  }
  return map;
}

function uniqueAuthors(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    for (const part of raw.split(/[,;]|(?:\s+and\s+)/i)) {
      const t = part.trim();
      if (!t || t.length > 200) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= 20) return out;
    }
  }
  return out;
}

function resolveCanonical(href: string | null, pageUrl: string): string | null {
  if (!href?.trim()) return null;
  try {
    return new URL(href.trim(), pageUrl).href;
  } catch {
    return null;
  }
}

function firstMatch(re: RegExp, html: string): string | null {
  const m = html.match(re);
  return m?.[1] ? stripTags(m[1]) : null;
}

/** Extract Open Graph / HTML head metadata from a fetched page (first ~512KB is enough). */
export function extractSourceMetadataFromHtml(html: string, pageUrl: string): SourceMetadata {
  const headEnd = html.search(/<\/head>/i);
  const slice = headEnd > 0 ? html.slice(0, headEnd + 7) : html.slice(0, 200_000);
  const meta = readMetaMap(slice);

  const ogTitle = meta.get("og:title") ?? meta.get("twitter:title");
  const docTitle = firstMatch(TITLE_RE, slice);
  const h1 = firstMatch(H1_RE, slice);
  const title = (ogTitle ?? docTitle ?? h1)?.slice(0, 500) ?? null;

  const canonical =
    resolveCanonical(firstMatch(LINK_CANONICAL_RE, slice) ?? firstMatch(LINK_CANONICAL_RE_ALT, slice), pageUrl) ??
    pageUrl;

  const authors = uniqueAuthors([
    meta.get("author") ?? "",
    meta.get("article:author") ?? "",
    meta.get("citation_author") ?? "",
  ].filter(Boolean));

  const description = (meta.get("og:description") ?? meta.get("description") ?? meta.get("twitter:description"))
    ?.slice(0, 2000) ?? null;

  const site_name = (meta.get("og:site_name") ?? meta.get("application-name"))?.slice(0, 200) ?? null;
  const published_at =
    (meta.get("article:published_time") ?? meta.get("datePublished") ?? meta.get("pubdate"))?.slice(0, 80) ?? null;

  return {
    title,
    canonical_url: canonical,
    url: pageUrl,
    authors,
    description,
    site_name,
    published_at,
  };
}

/** Build a short provenance block for graph source text_preview. */
export function formatSourceProvenancePreview(meta: SourceMetadata): string | null {
  const lines: string[] = [];
  if (meta.authors.length) lines.push(`Authors: ${meta.authors.join("; ")}`);
  if (meta.site_name) lines.push(`Publisher: ${meta.site_name}`);
  if (meta.published_at) lines.push(`Published: ${meta.published_at}`);
  if (meta.description) lines.push(meta.description.slice(0, 400));
  if (!lines.length) return null;
  return lines.join("\n").slice(0, 500);
}
