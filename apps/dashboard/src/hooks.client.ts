import posthog from "posthog-js";
import { env } from "$env/dynamic/public";

const key = env.PUBLIC_POSTHOG_KEY;
const host = env.PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

if (key) {
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    persistence: "localStorage+cookie",
    loaded: (ph) => {
      // Ensure feature flags are fetched on load
      ph.reloadFeatureFlags();
    },
  });
}
