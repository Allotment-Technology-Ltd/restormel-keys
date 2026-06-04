import posthog from "posthog-js";
import { env } from "$env/dynamic/public";

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
    void fetch(`${DASHBOARD_PREFIX}/api/auth/get-session`, {
      credentials: "include",
      cache: "no-store",
    });
  };

  refresh();
  window.setInterval(refresh, SESSION_REFRESH_MS);
}

void clearStaleServiceWorkers();
setupAuthSessionRefresh();

const key = env.PUBLIC_POSTHOG_KEY;
/**
 * Restormel Keys PostHog project is on EU Cloud. Override with PUBLIC_POSTHOG_HOST (e.g. https://us.i.posthog.com) for US projects.
 */
const host = env.PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

if (key) {
  posthog.init(key, {
    api_host: host,
    defaults: "2026-01-30",
    capture_pageview: true,
    persistence: "localStorage+cookie",
    loaded: (ph) => {
      ph.reloadFeatureFlags();
    },
  });
}
