import posthog from "posthog-js";
import { env } from "$env/dynamic/public";

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
