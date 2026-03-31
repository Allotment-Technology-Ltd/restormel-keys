<script lang="ts">
  /** Root layout: wraps all routes (marketing, docs, dashboard). */
  import "../app.css";
  import { onMount } from "svelte";
  import posthog from "posthog-js";
  import { env } from "$env/dynamic/public";

  onMount(() => {
    window.rmCapture = (event: string, props?: Record<string, unknown>) => {
      if (!(env.PUBLIC_POSTHOG_KEY ?? "").trim()) return;
      try {
        posthog.capture?.(event, props);
      } catch {
        // no-op
      }
    };
  });
</script>

<slot />
