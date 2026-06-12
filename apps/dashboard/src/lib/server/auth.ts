/**
 * Neon Auth: proxy + session. Auth is managed in Neon Console (OAuth, etc.).
 * Requires NEON_AUTH_BASE_URL. NEON Auth URL must come from `$env/dynamic/private` so
 * `apps/dashboard/.env.local` is respected (Vite envDir); `process.env` alone does not.
 */
import { env } from "$env/dynamic/private";
import { dev } from "$app/environment";

export const baseUrl = () => env.NEON_AUTH_BASE_URL?.replace(/\/$/, "") ?? "";

function getSessionUrl(): string {
  const base = baseUrl();
  return base ? `${base}/get-session` : "";
}

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  /** Neon Auth / Better Auth may expose operator role (e.g. "admin") for dashboard users. */
  role?: string | null;
};

const LOCAL_COOKIE_PREFIX = "rksecure-";

function decodeLocalhostCookieHeader(cookieHeader: string, host: string): string {
  if (!host.startsWith("localhost") || !cookieHeader) return cookieHeader;
  // Translate localhost-safe cookie names back to Neon's __Secure-* names before proxying.
  return cookieHeader.replace(/(^|;\s*)rksecure-/g, "$1__Secure-");
}

function encodeLocalhostSetCookie(setCookie: string, host: string): string {
  if (!host.startsWith("localhost")) return setCookie;
  let out = setCookie;
  // Browsers reject __Secure-* on plain HTTP localhost in some environments.
  // Store localhost-safe names and translate back when forwarding Cookie headers.
  out = out.replace(/^__Secure-/, LOCAL_COOKIE_PREFIX);
  // Partitioned requires Secure; if we strip Secure for localhost, strip Partitioned too.
  out = out.replace(/;\s*Secure/gi, "");
  out = out.replace(/;\s*Partitioned/gi, "");
  // SameSite=None without Secure is rejected by modern browsers.
  // For localhost HTTP, downgrade to Lax so cookie persists and is sent on top-level callback navigation.
  out = out.replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
  return out;
}

function readSetCookieHeaders(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

/** Normalize Neon Auth Set-Cookie headers for our host (Path=/, localhost-safe names). */
export function rewriteAuthSetCookiesForHost(rawCookies: string[], ourHost: string): string[] {
  if (!ourHost || rawCookies.length === 0) return [];
  return rawCookies.map((cookie) => {
    const withoutDomain = cookie.replace(/;\s*Domain=[^;]+/gi, "") || cookie;
    const withRootPath = withoutDomain.replace(/;\s*Path=[^;]+/gi, "; Path=/");
    return encodeLocalhostSetCookie(withRootPath, ourHost);
  });
}

function forwardedPort(url: URL): string {
  if (url.port) return url.port;
  return url.protocol === "https:" ? "443" : "80";
}

function parseUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getPublicOrigin(request: Request, ourUrl: URL): string {
  const origin = parseUrl(request.headers.get("origin"));
  if (origin) return origin.origin;

  const referer = parseUrl(request.headers.get("referer"));
  if (referer) return referer.origin;

  return ourUrl.origin;
}

function buildProxyHeaders(request: Request, ourUrl: URL, targetUrl: URL): Headers {
  const headers = new Headers();
  const cookie = decodeLocalhostCookieHeader(request.headers.get("cookie") ?? "", ourUrl.host);
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  const acceptLanguage = request.headers.get("accept-language");
  const userAgent = request.headers.get("user-agent");
  const origin = getPublicOrigin(request, ourUrl);

  headers.set("host", targetUrl.host);
  headers.set("origin", origin);
  if (cookie) headers.set("cookie", cookie);
  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (acceptLanguage) headers.set("accept-language", acceptLanguage);
  if (userAgent) headers.set("user-agent", userAgent);

  return headers;
}

/**
 * Get current session from Neon Auth by forwarding the request’s cookies.
 */
export type GetSessionResult = {
  data: { user: SessionUser } | null;
  error: Error | null;
  /** Refreshed session cookies from Neon Auth — must be forwarded to the browser. */
  setCookies: string[];
  /**
   * W4.6a — verification could NOT be completed (Neon Auth 5xx, network throw, or a
   * 429 with no last-known-good to fall back on) for a request that DID carry a
   * session cookie. `data === null && degraded === true` means "we don't know if this
   * user is signed in", which is NOT the same as "genuinely signed out"
   * (`data === null && degraded === false`). Callers must render an auth-degraded /
   * retry state for the former, never the signed-out CTA. A genuine signed-out request
   * (Neon returns 200 `{user:null}`) is never degraded.
   */
  degraded: boolean;
};

/** Short TTL avoids hammering Neon Auth on every dashboard navigation (dev + prod). */
export const SESSION_CACHE_MS = 20_000;
/** @deprecated Use SESSION_CACHE_MS — kept for tests. */
export const PROD_SESSION_CACHE_MS = SESSION_CACHE_MS;
/**
 * Re-use last good session when Neon verification cannot complete (429 / 5xx / network
 * throw) instead of treating the user as logged out. Slightly longer than the happy-path
 * cache: this is the resilience window during an auth-infra blip.
 */
const STALE_SESSION_ON_FAILURE_MS = 60_000;
/** @deprecated Use STALE_SESSION_ON_FAILURE_MS — name kept for readers/tests. */
const STALE_SESSION_ON_429_MS = STALE_SESSION_ON_FAILURE_MS;

type SessionCacheEntry = { at: number; result: GetSessionResult };
const sessionCache = new Map<string, SessionCacheEntry>();
const sessionInFlight = new Map<string, Promise<GetSessionResult>>();

function sessionCacheKey(host: string, cookie: string): string {
  return `${host}\0${cookie}`;
}

function readSessionCache(key: string, maxAgeMs: number): GetSessionResult | null {
  const hit = sessionCache.get(key);
  if (!hit || Date.now() - hit.at > maxAgeMs) return null;
  return hit.result;
}

function writeSessionCache(key: string, result: GetSessionResult): void {
  if (result.data?.user) {
    sessionCache.set(key, { at: Date.now(), result });
  }
}

/**
 * Last-known-good fallback for a verification that could not complete (429 / 5xx).
 * Returns the cached signed-in session if one is still within the resilience window,
 * otherwise a `degraded` miss — NEVER a clean signed-out (which would be a silent
 * demotion). `void STALE_SESSION_ON_429_MS` keeps the back-compat alias referenced.
 */
function lastKnownGoodOrDegraded(
  cacheKey: string,
  setCookies: string[],
  reason: string,
): GetSessionResult {
  void STALE_SESSION_ON_429_MS;
  const stale = readSessionCache(cacheKey, STALE_SESSION_ON_FAILURE_MS);
  if (stale?.data?.user) {
    if (dev) {
      console.warn(`[auth] Neon Auth ${reason}; using last-known-good session`);
    }
    return { ...stale, setCookies: stale.setCookies.length ? stale.setCookies : setCookies };
  }
  if (dev) {
    console.warn(`[auth] Neon Auth ${reason}; no cached session — auth degraded, render retry state`);
  }
  return { data: null, error: null, setCookies, degraded: true };
}

async function fetchSessionFromNeon(
  url: string,
  cookie: string,
  host: string,
  cacheKey: string,
): Promise<GetSessionResult> {
  const res = await fetch(url, {
    method: "GET",
    headers: { cookie },
    cache: "no-store",
  });
  const setCookies = res.ok
    ? rewriteAuthSetCookiesForHost(readSetCookieHeaders(res.headers), host)
    : [];

  // 429 (rate limit) and 5xx (Neon Auth infra blip) are verification FAILURES, not a
  // signed-out signal. Fall back to last-known-good; otherwise report degraded so hooks
  // renders an auth-error/retry surface instead of silently demoting to signed-out.
  if (res.status === 429) {
    return lastKnownGoodOrDegraded(cacheKey, setCookies, "rate limited (429)");
  }
  if (res.status >= 500) {
    return lastKnownGoodOrDegraded(cacheKey, setCookies, `error (${res.status})`);
  }

  // Other non-ok (e.g. 4xx other than 429): the cookie did not resolve to a session.
  // This is a genuine signed-out state — not degraded.
  if (!res.ok) {
    return { data: null, error: null, setCookies, degraded: false };
  }

  const data = (await res.json()) as { user?: SessionUser; session?: unknown } | null;
  const user = data?.user ?? null;
  const result: GetSessionResult = {
    data: user ? { user } : null,
    error: null,
    setCookies,
    degraded: false,
  };
  writeSessionCache(cacheKey, result);
  return result;
}

/**
 * Neon Auth (Better Auth) session cookies are always `__Secure-*` in production
 * (`rksecure-*` is our localhost alias, decoded back before this check). A request
 * without one cannot resolve to a session, so we can skip the get-session round-trip —
 * anonymous marketing/docs/bot traffic otherwise pays a full Neon Auth HTTP call per
 * request (the session cache only stores hits, so misses were never cached).
 */
export function cookieHeaderMayCarrySession(cookie: string): boolean {
  if (!cookie) return false;
  return /(?:^|;\s*)(?:__Secure-|rksecure-)[^=;]*=/.test(cookie);
}

export async function getSession(
  request: Request,
  host = ""
): Promise<GetSessionResult> {
  const url = getSessionUrl();
  // Not configured: genuinely no session (not degraded — there is nothing to verify).
  if (!url) {
    return { data: null, error: null, setCookies: [], degraded: false };
  }
  const cookie = decodeLocalhostCookieHeader(request.headers.get("cookie") ?? "", host);
  // No session cookie at all: genuinely signed out — never degraded.
  if (!cookieHeaderMayCarrySession(cookie)) {
    return { data: null, error: null, setCookies: [], degraded: false };
  }
  const cacheKey = sessionCacheKey(host, cookie);
  try {
    const cacheTtlMs = SESSION_CACHE_MS;
    const fresh = readSessionCache(cacheKey, cacheTtlMs);
    if (fresh) return fresh;

    const inFlight = sessionInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const promise = fetchSessionFromNeon(url, cookie, host, cacheKey).finally(() => {
      sessionInFlight.delete(cacheKey);
    });
    sessionInFlight.set(cacheKey, promise);
    return await promise;
  } catch (e) {
    // A network throw is a verification FAILURE, not a signed-out signal. Fall back to
    // last-known-good if we have one; otherwise report degraded so the request renders an
    // auth-error/retry state instead of silently demoting a signed-in user to signed-out.
    const fallback = lastKnownGoodOrDegraded(cacheKey, [], "unreachable");
    return { ...fallback, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Proxy a request to Neon Auth and return the response, optionally rewriting Set-Cookie and Location to our host.
 */
export async function proxyAuthRequest(
  path: string,
  request: Request,
  ourUrl: URL
): Promise<Response> {
  const base = baseUrl();
  if (!base) {
    const raw = env.NEON_AUTH_BASE_URL;
    console.error("[auth] NEON_AUTH_BASE_URL is not set; returning 503. (typeof:", typeof raw, "length:", raw?.length ?? 0, ") Set it in apps/dashboard/.env or .env.local (or Vercel env for production).");
    return new Response(JSON.stringify({ error: "Neon Auth not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const pathPart = path.replace(/^\//, "");
  const targetUrl = new URL(`${base}/${pathPart}`);
  targetUrl.search = ourUrl.search;
  const ourHost = ourUrl.host;
  const ourOrigin = ourUrl.origin;
  const headers = buildProxyHeaders(request, ourUrl, targetUrl);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const res = await fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual",
    ...(hasBody && { duplex: "half" as const }),
  } as RequestInit);
  if (res.status === 503) {
    console.error("[auth] Neon Auth returned 503 for", path, "— check NEON_AUTH_BASE_URL and that Auth is enabled in Neon Console.");
  }
  // Log 4xx body so we can see Neon's error message in Vercel logs
  let bodyToReturn: BodyInit = res.body ?? "";
  if (res.status >= 400 && res.status < 500) {
    const errText = await res.text();
    console.error("[auth] Neon Auth", res.status, "for", path, "—", errText.slice(0, 600));
    console.error("[auth] forwarded headers", {
      host: headers.get("host"),
      origin: headers.get("origin"),
      contentType: headers.get("content-type"),
      accept: headers.get("accept"),
      hasCookie: Boolean(headers.get("cookie")),
    });
    bodyToReturn = errText;
  }
  const outHeaders = new Headers(res.headers);
  const rewritten = rewriteAuthSetCookiesForHost(readSetCookieHeaders(res.headers), ourHost);
  if (rewritten.length > 0) {
    outHeaders.delete("Set-Cookie");
    for (const cookie of rewritten) {
      outHeaders.append("Set-Cookie", cookie);
    }
  }
  // Rewrite redirect Location so the user lands on our dashboard root (not Neon Auth)
  const location = outHeaders.get("Location");
  if (location && res.status >= 300 && res.status < 400) {
    try {
      const locUrl = new URL(location);
      const neonHost = new URL(base).host;
      if (locUrl.host === neonHost) {
        const dashboardRoot = ourUrl.pathname.replace(/\/api\/auth\/.*$/, "") || "/";
        const redirectTo =
          ourOrigin +
          (dashboardRoot.endsWith("/") ? dashboardRoot : dashboardRoot + "/") +
          (locUrl.search || "");
        outHeaders.set("Location", redirectTo);
      }
    } catch {
      // leave Location as-is if not a valid URL
    }
  }
  return new Response(bodyToReturn, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}
