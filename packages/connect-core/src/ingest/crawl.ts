/**
 * Pure URL-discovery helpers for the website/sitemap crawler. No network — the
 * host fetches; these parse. Kept here so they are trivially unit-testable.
 */

function isCrawlableHref(href: string): boolean {
  const h = href.trim();
  if (!h) return false;
  return !/^(#|mailto:|tel:|javascript:|data:)/i.test(h);
}

/** Extract crawlable absolute links from an HTML page, resolved against baseUrl. */
export function extractLinks(
  html: string,
  baseUrl: string,
  opts?: { sameHostOnly?: boolean },
): string[] {
  const sameHostOnly = opts?.sameHostOnly ?? true;
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  const out = new Set<string>();
  const re = /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1] ?? m[2] ?? "";
    if (!isCrawlableHref(href)) continue;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      continue;
    }
    abs.hash = "";
    if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
    if (sameHostOnly && abs.host !== base.host) continue;
    out.add(abs.toString());
  }
  return [...out];
}

/** Extract page URLs from a sitemap.xml document (<loc> entries). */
export function parseSitemapUrls(xml: string): string[] {
  const out = new Set<string>();
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const u = m[1].trim();
    if (/^https?:\/\//i.test(u)) out.add(u);
  }
  return [...out];
}

/** Default sitemap URL for a site root. */
export function sitemapUrlFor(rootUrl: string): string | null {
  try {
    const u = new URL(rootUrl);
    return `${u.protocol}//${u.host}/sitemap.xml`;
  } catch {
    return null;
  }
}
