<script lang="ts">
  /** Shared tab strip for multi-step dashboard hubs (Knowledge, Testing, …). */
  export let ariaLabel: string;
  export let tabs: { href: string; label: string; exact: boolean }[];
  /** Hide hub tabs during focused flows (e.g. pipeline setup wizard). */
  export let hideTabs = false;

  import { page } from "$app/stores";

  $: currentPath = $page.url.pathname;

  function isActive(href: string, exact: boolean): boolean {
    if (exact) return currentPath === href;
    return currentPath === href || currentPath.startsWith(href + "/");
  }
</script>

{#if !hideTabs}
<nav class="hub-tabs" aria-label={ariaLabel}>
  {#each tabs as tab}
    <a
      href={tab.href}
      class="hub-tab"
      class:hub-tab-active={isActive(tab.href, tab.exact)}
      aria-current={isActive(tab.href, tab.exact) ? "page" : undefined}
    >
      {tab.label}
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
</style>
