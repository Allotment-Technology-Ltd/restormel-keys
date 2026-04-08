/**
 * Navigation allowlist for the built-in AC browser agent (beyond same-origin to base_url).
 * Hostnames are compared case-insensitively; no secrets belong here.
 */

function normalizeHostname(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "") return "";
  try {
    if (t.includes("://")) {
      return new URL(t).hostname.toLowerCase();
    }
  } catch {
    return "";
  }
  return t.replace(/^\[|\]$/g, "");
}

/** Normalise YAML allowlist entries to bare hostnames. */
export function normalizeEgressAllowHosts(entries: string[] | undefined): string[] {
  if (entries === undefined || entries.length === 0) return [];
  const out: string[] = [];
  for (const e of entries) {
    const h = normalizeHostname(e);
    if (h.length > 0) out.push(h);
  }
  return out;
}

export function isHostnameAllowedForNavigation(
  target: URL,
  baseUrl: string,
  egressAllowHosts: string[] | undefined,
): boolean {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return false;
  }
  if (target.origin === base.origin) return true;
  const allowed = normalizeEgressAllowHosts(egressAllowHosts);
  if (allowed.length === 0) return false;
  const host = target.hostname.toLowerCase();
  return allowed.includes(host);
}

/**
 * Resolve a navigate URL for the agent: same origin as base_url, or host on egress_allow_hosts.
 */
export function resolveAgentNavigateUrl(
  href: string,
  baseUrl: string,
  currentPageUrl: string | undefined,
  egressAllowHosts: string[] | undefined,
): string | null {
  try {
    const base = new URL(baseUrl);
    const fromBase = new URL(href.trim(), base);
    if (isHostnameAllowedForNavigation(fromBase, baseUrl, egressAllowHosts)) {
      return fromBase.href;
    }
    if (currentPageUrl) {
      const cur = new URL(currentPageUrl);
      const fromPage = new URL(href.trim(), cur);
      if (isHostnameAllowedForNavigation(fromPage, baseUrl, egressAllowHosts)) {
        return fromPage.href;
      }
    }
    return null;
  } catch {
    return null;
  }
}
