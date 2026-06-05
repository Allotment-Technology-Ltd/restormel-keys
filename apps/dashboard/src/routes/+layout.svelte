<script lang="ts">
  /** Root layout: wraps all routes (marketing, docs, dashboard). */
  import "../app.css";
  import { onMount } from "svelte";
  import { env } from "$env/dynamic/public";
  import SupportAssistant from "$lib/components/site/SupportAssistant.svelte";
  import { agentLog } from "$lib/debug/agent-log";
  import type { LayoutData } from "./$types";

  export let data: LayoutData;

  onMount(() => {
    // #region agent log
    agentLog(
      "routes/+layout.svelte:onMount",
      "root layout hydrated",
      { hasUser: !!data.user, authType: data.user?.authType ?? null },
      "H1"
    );
    // #endregion
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

<SupportAssistant user={data.user ?? undefined} />
<slot />
