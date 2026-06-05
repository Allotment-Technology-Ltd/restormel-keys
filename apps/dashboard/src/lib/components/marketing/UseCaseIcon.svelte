<script lang="ts">
  /**
   * SSR-safe use-case icons. Lucide loads only on the client (dynamic import).
   * @lucide/svelte + Svelte 5 SSR throws "Cannot access 'props' before initialization".
   */
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import type { Component } from "svelte";
  import type { UseCaseIconName } from "$lib/content/use-case-icons";
  import { agentLog } from "$lib/debug/agent-log";

  export let name: UseCaseIconName;
  export let size = 20;
  export let strokeWidth = 2.25;

  let Icon: Component | null = null;

  function loadIcon(next: UseCaseIconName) {
    if (!browser) return;
    Icon = null;
    void import("./use-case-lucide-icons.js")
      .then((mod) => {
        Icon = mod.lucideUseCaseIcon(next);
        // #region agent log
        agentLog("UseCaseIcon.svelte:loadIcon", "lucide loaded", { name: next }, "H2");
        // #endregion
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        // #region agent log
        agentLog("UseCaseIcon.svelte:loadIcon-fail", "lucide import failed", { name: next, msg }, "H2");
        // #endregion
      });
  }

  onMount(() => loadIcon(name));

  $: if (browser && name) loadIcon(name);
</script>

{#if browser && Icon}
  <svelte:component this={Icon} {size} {strokeWidth} />
{:else}
  <span
    class="uc-icon-fallback"
    style="width: {size}px; height: {size}px;"
    aria-hidden="true"
  ></span>
{/if}

<style>
  .uc-icon-fallback {
    display: inline-block;
    flex-shrink: 0;
    border: 2px solid currentColor;
    background: color-mix(in oklab, currentColor 12%, transparent);
    box-sizing: border-box;
  }
</style>
