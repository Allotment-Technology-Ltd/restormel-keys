<script lang="ts">
  /** Root layout: wraps all routes (marketing, docs, dashboard). */
  import "../app.css";
  import { onMount } from "svelte";
  import { env } from "$env/dynamic/public";
  import SupportAssistant from "$lib/components/site/SupportAssistant.svelte";

  onMount(() => {
    void (async () => {
      const posthog = (await import("posthog-js")).default;
      window.rmCapture = (event: string, props?: Record<string, unknown>) => {
        if (!(env.PUBLIC_POSTHOG_KEY ?? "").trim()) return;
        try {
          posthog.capture?.(event, props);
        } catch {
          // no-op
        }
      };
    })();
  });
</script>

<SupportAssistant />
<slot />
