import { browser, dev } from "$app/environment";
import type { HandleClientError } from "@sveltejs/kit";
import posthog from "posthog-js";
import { env } from "$env/dynamic/public";
import { reportClientDebug, reportClientError, setupClientDebugCapture } from "$lib/debug/client-debug";

const DASHBOARD_PREFIX = "/keys/dashboard";
const SESSION_REFRESH_MS = 4 * 60 * 1000;

/** Drop stale service workers that poll /sw.js from older installs. */
async function clearStaleServiceWorkers(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // Non-fatal — static/sw.js also self-unregisters when fetched.
  }
}

/** Keep Neon Auth session cookies fresh via the existing auth proxy. */
function setupAuthSessionRefresh(): void {
  if (typeof window === "undefined") return;
  if (!window.location.pathname.startsWith(DASHBOARD_PREFIX)) return;

  const refresh = () => {
    void fetch(`${DASHBOARD_PREFIX}/api/auth/session-cache`, {
      credentials: "include",
      cache: "no-store",
    });
  };

  refresh();
  window.setInterval(refresh, SESSION_REFRESH_MS);
}

if (browser) {
  setupClientDebugCapture();
  void clearStaleServiceWorkers();
  setupAuthSessionRefresh();
}

const key = env.PUBLIC_POSTHOG_KEY;
/**
 * Restormel Keys PostHog project is on EU Cloud. Override with PUBLIC_POSTHOG_HOST (e.g. https://us.i.posthog.com) for US projects.
 */
const host = env.PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

if (browser && key) {
  posthog.init(key, {
    api_host: host,
    defaults: "2026-01-30",
    capture_pageview: true,
    persistence: "localStorage+cookie",
    loaded: (ph) => {
      reportClientDebug("hooks.client.ts:posthog-loaded", "posthog loaded", {}, "H5");
      ph.reloadFeatureFlags();
    },
  });
}

export const handleClientError: HandleClientError = ({ error, event, status }) => {
  const detail = {
    pathname: event.url.pathname,
    search: event.url.search,
    status,
    routeId: event.route.id ?? null,
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "Unknown",
  };
  reportClientError("hooks.client.ts:handleClientError", error, detail, "CX-SKIT");
  if (dev) {
    console.error("[restormel] SvelteKit client error", detail, error);
  }
  return { message: "Internal Error" };
};
