<script lang="ts">
  /** Root layout: wraps all routes (marketing, docs, dashboard). */
  import "../app.css";
  import { onMount } from "svelte";
  import { env } from "$env/dynamic/public";

  function ensurePostHog(): void {
    const key = (env.PUBLIC_POSTHOG_KEY ?? "").trim();
    if (!key) return;
    if (window.posthog?.capture) return;

    const host = (env.PUBLIC_POSTHOG_HOST ?? "").trim() || "https://app.posthog.com";

    // Minimal PostHog snippet (no dependency), loaded only when key is present.
    // Public key only; never include secrets.
    const script = document.createElement("script");
    script.async = true;
    script.src = `${host.replace(/\/$/, "")}/static/array.js`;
    script.onload = () => {
      window.posthog?.init?.(key, {
        api_host: host,
        autocapture: false,
        capture_pageview: false,
      });
    };
    document.head.appendChild(script);
  }

  onMount(() => {
    ensurePostHog();
    window.rmCapture = (event: string, props?: Record<string, unknown>) => {
      try {
        window.posthog?.capture?.(event, props);
      } catch {
        // no-op
      }
    };
  });
</script>

<slot />
