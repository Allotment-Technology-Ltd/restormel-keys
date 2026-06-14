import { browser, dev } from "$app/environment";
import type { HandleClientError } from "@sveltejs/kit";
import posthog from "posthog-js";
import { env } from "$env/dynamic/public";
import { get } from "svelte/store";
import { page } from "$app/stores";
import { invalidateAll } from "$app/navigation";
import { reportClientDebug, reportClientError, setupClientDebugCapture } from "$lib/debug/client-debug";
import { shouldInvalidateOnSessionPoll, type SessionCacheSignal } from "$lib/auth-change";
import { getConsentState } from "$lib/analytics/consent";
import { setupAnalyticsHandlers, resetForNavigation } from "$lib/analytics/global-handlers";

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

/**
 * Keep Neon Auth session cookies fresh via the existing auth proxy, AND keep the shell
 * and page loads in agreement: when the refresh poll reports an auth-state CHANGE
 * (signed-in→out or vice versa) vs. what the client currently has rendered, call
 * `invalidateAll()` so the layout (shell) and every page re-run against the new truth.
 * A `degraded` poll (verification couldn't complete) is never treated as a change.
 */
function setupAuthSessionRefresh(): void {
  if (typeof window === "undefined") return;
  if (!window.location.pathname.startsWith(DASHBOARD_PREFIX)) return;

  const refresh = async () => {
    try {
      const res = await fetch(`${DASHBOARD_PREFIX}/api/auth/session-cache`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const signal = (await res.json()) as SessionCacheSignal;
      const currentlySignedIn = Boolean(get(page).data.user);
      if (shouldInvalidateOnSessionPoll(currentlySignedIn, signal)) {
        await invalidateAll();
      }
    } catch {
      // Network hiccup on the refresh poll is non-fatal — try again next interval.
    }
  };

  void refresh();
  window.setInterval(() => void refresh(), SESSION_REFRESH_MS);
}

/** Lazily read the rendered signed-in state for analytics enrichment. */
function isSignedIn(): boolean {
  try {
    return Boolean(get(page).data.user);
  } catch {
    return false;
  }
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
  // EU consent gating: default to cookieless (memory-only) persistence and no
  // autocapture until the visitor explicitly opts in. See $lib/analytics/consent.
  const consent = getConsentState();
  const granted = consent === "granted";

  posthog.init(key, {
    api_host: host,
    defaults: "2026-01-30",
    capture_pageview: true,
    // Persistent identity (cookie + localStorage) ONLY after opt-in; otherwise
    // memory-only so no identifying storage is written pre-consent.
    persistence: granted ? "localStorage+cookie" : "memory",
    // Autocapture (broad DOM event capture) is opt-in to keep cookieless mode minimal.
    autocapture: granted,
    loaded: (ph) => {
      reportClientDebug("hooks.client.ts:posthog-loaded", "posthog loaded", { consent }, "H5");
      // Honour an explicit opt-out — stop all capture entirely.
      if (consent === "denied") {
        ph.opt_out_capturing();
      }
      ph.reloadFeatureFlags();
    },
  });

  // Global handlers: enriched pageview props (route group + signed-in),
  // outbound-link capture, and scroll-depth milestones. Reset on SPA nav.
  setupAnalyticsHandlers({ isSignedIn });
  page.subscribe(() => resetForNavigation(isSignedIn));
}

/**
 * Redacted PostHog client-error capture.
 *
 * Capture contract:
 *   ALLOWED:  error name, truncated message, pathname (no query string),
 *             HTTP status, route ID.
 *   STRIPPED: event.url.search (may contain auth tokens), error.stack
 *             (may contain local paths), any PII.
 *
 * Gated on: (a) PostHog key present, (b) consent granted, (c) PostHog loaded.
 * Fire-and-forget.
 */
function captureClientError(
  error: unknown,
  event: Parameters<HandleClientError>[0]["event"],
  status: number,
): void {
  // Only capture if PostHog is initialised and the key is set.
  if (!key) return;
  // Guard for the case where posthog hasn't initialised yet (e.g. very early throw).
  if (typeof posthog?.capture !== "function") return;

  const errorName = error instanceof Error ? error.name : "NonError";
  const errorMessage = (error instanceof Error ? error.message : String(error)).slice(0, 300);

  // Capture pathname only — never search/hash.
  const pathname = event.url.pathname.slice(0, 200);
  const routeId = event.route?.id ?? null;

  posthog.capture("client_error", {
    error_name: errorName.slice(0, 80),
    error_message: errorMessage,
    pathname,
    route_id: routeId ? String(routeId).slice(0, 120) : null,
    status,
    $lib: "restormel-hooks-client",
  });
}

export const handleClientError: HandleClientError = ({ error, event, status }) => {
  const detail = {
    // Exclude search: may contain auth tokens or key IDs.
    pathname: event.url.pathname,
    status,
    routeId: event.route.id ?? null,
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "Unknown",
  };
  reportClientError("hooks.client.ts:handleClientError", error, detail, "CX-SKIT");
  if (dev) {
    console.error("[restormel] SvelteKit client error", detail, error);
  }
  // PostHog exception capture (redacted — see captureClientError above).
  captureClientError(error, event, status);
  return { message: "Internal Error" };
};
