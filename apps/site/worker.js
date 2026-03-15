/**
 * Worker that serves static assets from the Astro build (dist/) and proxies
 * /keys/dashboard to the dashboard backend (Cloud Run).
 *
 * Set KEYS_DASHBOARD_URL in Cloudflare (Settings → Variables) to the Cloud Run
 * URL (e.g. https://keys-dashboard-xxx.run.app, no trailing slash). If unset,
 * /keys/dashboard is not proxied and will 404.
 */
const DASHBOARD_PREFIX = "/keys/dashboard";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const base = env.KEYS_DASHBOARD_URL?.trim();

    if (base && (url.pathname === DASHBOARD_PREFIX || url.pathname.startsWith(DASHBOARD_PREFIX + "/"))) {
      return proxyToDashboard(request, url, base);
    }

    return env.ASSETS.fetch(request);
  },
};

/**
 * Forward request to the dashboard backend. Preserves method, body, and
 * forwards cookies and Host so the app sees the public origin (restormel.dev).
 */
async function proxyToDashboard(request, url, base) {
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

  const outHeaders = new Headers(res.headers);
  // Avoid duplex issues when body is used
  const opts = { status: res.status, statusText: res.statusText, headers: outHeaders };
  return new Response(res.body, opts);
}
