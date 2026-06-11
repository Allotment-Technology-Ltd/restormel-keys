<script lang="ts">
  /** Shared tab strip for multi-step dashboard hubs (Knowledge, Testing, …). */
  import type { HubTab } from "$lib/dashboard-hub-nav";

  export let ariaLabel: string;
  export let tabs: HubTab[];
  /** Hide hub tabs during focused flows (e.g. pipeline setup wizard). */
  export let hideTabs = false;
  /** Tap-prefetch Connect hub tabs on intentional navigation (avoids hover fan-out on heavy routes). */
  export let prefetchTabs = false;
  export let ariaBusy = false;

  import { page } from "$app/stores";

  $: currentPath = $page.url.pathname;

  function isActive(href: string, exact: boolean): boolean {
    if (exact) return currentPath === href;
    return currentPath === href || currentPath.startsWith(href + "/");
  }
</script>

{#if !hideTabs}
<nav class="hub-tabs" aria-label={ariaLabel} aria-busy={ariaBusy}>
  {#each tabs as tab}
    <a
      href={tab.href}
      class="hub-tab"
      class:hub-tab-active={isActive(tab.href, tab.exact)}
      aria-current={isActive(tab.href, tab.exact) ? "page" : undefined}
      data-sveltekit-preload-data={prefetchTabs ? "tap" : undefined}
      aria-label={tab.badge && tab.badge > 0
        ? `${tab.label} — ${tab.badge} ${tab.badge === 1 ? "claim needs" : "claims need"} review`
        : undefined}
    >
      {tab.label}
      {#if tab.badge && tab.badge > 0}
        <span class="hub-tab-badge" aria-hidden="true">{tab.badge}</span>
      {/if}
    </a>
  {/each}
</nav>
{/if}

<slot />

<style>
  .hub-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    border-bottom: var(--border);
    margin-bottom: var(--space-5);
  }
  .hub-tab {
    padding: var(--space-2) var(--space-4);
    color: var(--color-ink-muted);
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
    text-decoration: none;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    border-left: var(--border);
  }
  .hub-tab:first-child {
    border-left: none;
  }
  .hub-tab:hover {
    color: var(--color-ink);
    background: var(--color-bg-deep);
    text-decoration: none;
  }
  .hub-tab-active {
    color: var(--color-ink);
    background: var(--color-yellow);
    border-bottom-color: var(--color-ink);
  }

  .hub-tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: var(--space-2);
    min-width: 1.25em;
    height: 1.25em;
    padding: 0 0.3em;
    border-radius: 999px;
    background: var(--color-ink);
    color: var(--color-bg);
    font-size: 0.7em;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0;
    vertical-align: middle;
  }

  .hub-tab-active .hub-tab-badge {
    background: var(--color-ink);
    color: var(--color-yellow);
  }
</style>
