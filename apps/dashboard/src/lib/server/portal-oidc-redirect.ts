/**
 * OIDC redirect_uri allowlist for the Zuplo Developer Portal flow.
 * Prevents open redirects when completing login at /keys/auth/callback or authorize fast-path.
 */
function parseExtraOrigins(): Set<string> {
  const raw = process.env.PORTAL_ALLOWED_ORIGINS?.trim();
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (!s) continue;
    try {
      out.add(new URL(s).origin);
    } catch {
      // ignore invalid entries
    }
  }
  return out;
}

export function isAllowedPortalOidcRedirectUri(redirectUri: string): boolean {
  if (!redirectUri || redirectUri.length > 2048) return false;
  try {
    const u = new URL(redirectUri);
    const proto = u.protocol.toLowerCase();
    const host = u.hostname.toLowerCase();
    if (proto === "https:") {
      if (host.endsWith(".zuplo.site") || host.endsWith(".zuplo.app")) return true;
    }
    if (proto === "http:" && (host === "localhost" || host === "127.0.0.1")) return true;
    const extra = parseExtraOrigins();
    return extra.has(u.origin);
  } catch {
    return false;
  }
}
