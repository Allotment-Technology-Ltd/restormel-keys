/**
 * Worker that serves static assets from the Astro build (dist/) and proxies
 * /keys/dashboard to the dashboard backend (Cloud Run).
 *
 * Set KEYS_DASHBOARD_URL in Cloudflare (Settings → Variables) to the Cloud Run
 * origin only (e.g. https://keys-dashboard-xxx.run.app). Do not append /keys/dashboard
 * — the Worker appends the request path. If unset, /keys/dashboard is not proxied.
 */
const DASHBOARD_PREFIX = "/keys/dashboard";
const PROXY_STATUS_PATH = "/keys/dashboard-proxy-status";

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // Diagnostic: GET /keys/dashboard-proxy-status → 200 + { proxy, backendConfigured }
      if (url.pathname === PROXY_STATUS_PATH) {
        const base = env.KEYS_DASHBOARD_URL?.trim();
        return new Response(
          JSON.stringify({
            proxy: "active",
            backendConfigured: !!base,
            path: url.pathname,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const base = env.KEYS_DASHBOARD_URL?.trim();
      if (base && (url.pathname === DASHBOARD_PREFIX || url.pathname.startsWith(DASHBOARD_PREFIX + "/"))) {
        const proxyRes = await proxyToDashboard(request, url, base);
        if (proxyRes) return proxyRes;
        return new Response("Dashboard backend unavailable.", { status: 502 });
      }

      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Not found.", { status: 404 });
    } catch (err) {
      return new Response("Worker error.", { status: 500 });
    }
  },
};

/**
 * Forward request to the dashboard backend. Preserves method, body, and
 * forwards cookies and Host so the app sees the public origin (restormel.dev).
 * Returns null if the backend fetch throws (caller returns 502).
 */
async function proxyToDashboard(request, url, base) {
  try {
    const backendUrl = base + url.pathname + url.search;
    const headers = new Headers(request.headers);

    // So the dashboard sees the public origin (for redirects, url.origin, etc.)
    headers.set("Host", url.host);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
    headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") ?? "");

    const res = await fetch(backendUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });

    // Copy all headers; Set-Cookie must be forwarded explicitly (can be dropped when copying Headers)
    const outHeaders = new Headers();
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const [name, value] of res.headers.entries()) {
      if (name.toLowerCase() === "set-cookie") continue;
      outHeaders.set(name, value);
    }
    for (const cookie of setCookies) {
      outHeaders.append("Set-Cookie", cookie);
    }
    // If getSetCookie isn't available, fall back to single get (one cookie)
    if (setCookies.length === 0) {
      const one = res.headers.get("Set-Cookie");
      if (one) outHeaders.set("Set-Cookie", one);
    }
    const opts = { status: res.status, statusText: res.statusText, headers: outHeaders };
    return new Response(res.body, opts);
  } catch {
    return null;
  }
}
