/**
 * Neon Auth: proxy + session. Auth is managed in Neon Console (OAuth, etc.).
 * Requires NEON_AUTH_BASE_URL. NEON Auth URL must come from `$env/dynamic/private` so
 * `apps/dashboard/.env.local` is respected (Vite envDir); `process.env` alone does not.
 */
import { env } from "$env/dynamic/private";

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
};

export async function getSession(
  request: Request,
  host = ""
): Promise<GetSessionResult> {
  const url = getSessionUrl();
  if (!url) {
    return { data: null, error: null, setCookies: [] };
  }
  try {
    const cookie = decodeLocalhostCookieHeader(request.headers.get("cookie") ?? "", host);
    const res = await fetch(url, {
      method: "GET",
      headers: { cookie },
      cache: "no-store",
    });
    const setCookies = res.ok
      ? rewriteAuthSetCookiesForHost(readSetCookieHeaders(res.headers), host)
      : [];
    if (!res.ok) {
      return { data: null, error: null, setCookies };
    }
    const data = (await res.json()) as { user?: SessionUser; session?: unknown } | null;
    const user = data?.user ?? null;
    return { data: user ? { user } : null, error: null, setCookies };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)), setCookies: [] };
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
