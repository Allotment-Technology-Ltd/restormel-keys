import type { BrowserContext } from "playwright";
import { isHostnameAllowedForNavigation } from "./egress-navigation.js";

type PageWithOptionalContext = {
  context?: () => BrowserContext | undefined;
};

/**
 * Whether a browser-initiated request URL may leave the process (subresources, XHR, WS, navigations).
 * Allows in-document URLs (`data:`, `blob:`, `about:`); applies default-deny to other schemes.
 */
export function isBrowserEgressUrlAllowed(
  requestUrl: string,
  baseUrl: string,
  egressAllowHosts: string[] | undefined,
): boolean {
  let u: URL;
  try {
    u = new URL(requestUrl);
  } catch {
    return false;
  }
  const p = u.protocol.toLowerCase();
  if (p === "data:" || p === "blob:" || p === "about:") return true;
  if (p !== "http:" && p !== "https:" && p !== "ws:" && p !== "wss:") return false;
  return isHostnameAllowedForNavigation(u, baseUrl, egressAllowHosts);
}

/**
 * Default-deny egress for the whole browser context: block fetches, XHR, scripts, WS, etc. to any host
 * that is not the **`base_url` origin** or **`egress_allow_hosts`**. Call **before** the first navigation.
 */
export async function installBrowserEgressRouteBlock(
  context: BrowserContext,
  baseUrl: string,
  egressAllowHosts: string[] | undefined,
): Promise<void> {
  await context.route("**/*", async (route, request) => {
    const url = request.url();
    if (isBrowserEgressUrlAllowed(url, baseUrl, egressAllowHosts)) {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
}

/**
 * Installs {@link installBrowserEgressRouteBlock} when `session.page` is a real Playwright page.
 * Test mocks without `context()` are skipped (no policy).
 */
export async function installBrowserEgressRouteBlockForSession(
  session: { page: PageWithOptionalContext },
  baseUrl: string,
  egressAllowHosts: string[] | undefined,
): Promise<void> {
  const ctx = typeof session.page.context === "function" ? session.page.context() : undefined;
  if (ctx === undefined || typeof ctx.route !== "function") return;
  await installBrowserEgressRouteBlock(ctx, baseUrl, egressAllowHosts);
}
