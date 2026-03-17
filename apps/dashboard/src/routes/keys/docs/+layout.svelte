<script lang="ts">
  /** Docs layout — docs sidebar is collapsible and width-constrained. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { onMount } from "svelte";
  import { page } from "$app/stores";

  const STORAGE_KEY = "rk_docs_sidebar_collapsed";
  let collapsed = false;

  onMount(() => {
    collapsed = localStorage.getItem(STORAGE_KEY) === "true";
  });

  function toggle() {
    collapsed = !collapsed;
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }

  $: pathname = $page.url.pathname;
  $: docsPath = pathname.startsWith("/keys/docs") ? pathname.slice("/keys/docs".length) || "/" : pathname;
</script>

<svelte:head>
  <title>Docs — Restormel Keys</title>
</svelte:head>

<div class="docs-shell" class:docs-shell-collapsed={collapsed}>
  {#if collapsed}
    <button type="button" class="docs-nav-fab" aria-label="Expand docs navigation" on:click={toggle}>
      Expand nav
    </button>
  {/if}
  <nav class="docs-nav" aria-label="Docs navigation">
    <button type="button" class="docs-nav-toggle" aria-pressed={collapsed} on:click={toggle}>
      {collapsed ? "Expand nav" : "Collapse nav"}
    </button>
    <a href="/keys">Keys</a>
    <a href="/keys/docs">Overview</a>
    <a href="/keys/docs/walkthrough">Walkthrough</a>
    <div class="nav-divider" aria-hidden="true"></div>
    <div class="nav-section" aria-label="Guides section">Guides</div>
    <a href="/keys/docs/guides/provider-access-modes">Provider access modes</a>
    <a href="/keys/docs/guides/openrouter">OpenRouter</a>
    <a href="/keys/docs/guides/vercel-ai-gateway">Vercel AI Gateway</a>
    <a href="/keys/docs/guides/portkey">Portkey</a>
    <a href="/keys/docs/guides/integration-vs-hosted-vault">Integration vs hosted vault</a>
    <div class="nav-divider" aria-hidden="true"></div>
    <a href="/keys/docs/compatibility">Compatibility</a>
    <a href="/keys/docs/cloud-api">Cloud API</a>
    <a href={DASHBOARD_BASE}>Dashboard</a>
    <a href={DASHBOARD_BASE + "/login"}>Sign in</a>
  </nav>
  <main class="docs-main">
    <header class="docs-topbar" aria-label="Docs header">
      <div class="docs-topbar-title">Docs</div>
      <div class="docs-topbar-path" aria-hidden="true">{docsPath}</div>
    </header>
    <slot />
  </main>
</div>

<style>
  .docs-shell {
    display: flex;
    min-height: calc(100vh - var(--rm-nav-height));
    max-width: var(--rm-container-max);
    margin: 0 auto;
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    position: relative;
  }
  .docs-nav {
    width: 14rem;
    padding: var(--space-4);
    border-right: 1px solid var(--rm-border);
    background: var(--rm-surface);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .docs-nav-toggle {
    margin: 0 0 var(--space-3);
    width: 100%;
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-muted);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    text-align: left;
  }
  .docs-nav-toggle:hover {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
  }
  .docs-nav a {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .nav-divider {
    height: 1px;
    background: var(--rm-border);
    margin: var(--space-2) 0;
  }
  .nav-section {
    font-size: var(--text-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-dim);
    margin: var(--space-1) 0;
  }
  .docs-main {
    flex: 1;
    padding: var(--space-6);
  }
  .docs-topbar {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    margin: 0 0 var(--space-5);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--rm-border);
  }
  .docs-topbar-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--rm-text);
    line-height: 1.1;
  }
  .docs-topbar-path {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    font-family: var(--rm-font-ui);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
  }

  .docs-shell-collapsed .docs-nav {
    width: 0;
    padding: 0;
    border-right: 0;
    overflow: hidden;
  }
  .docs-shell-collapsed .docs-nav-toggle {
    display: none;
  }
  .docs-nav-fab {
    position: absolute;
    top: var(--space-4);
    left: var(--space-4);
    z-index: 10;
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
  }
  .docs-nav-fab:hover {
    background: var(--rm-surface);
  }

  /* Shared callout styles — each type has a distinct tint and border so cards don't blend into the page */
  .docs-main :global(.callout) {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    border: 1px solid var(--rm-border);
    border-left-width: 4px;
  }
  .docs-main :global(.callout a) {
    color: var(--rm-primary);
  }
  .docs-main :global(.callout strong:first-of-type) {
    font-weight: 600;
  }
  .docs-main :global(.callout-tip) {
    background: color-mix(in oklab, var(--rm-primary) 10%, var(--rm-surface));
    border-color: var(--rm-border);
    border-left-color: var(--rm-primary);
    color: var(--rm-muted);
  }
  .docs-main :global(.callout-tip strong:first-of-type) {
    color: var(--rm-primary);
  }
  .docs-main :global(.callout-note) {
    background: color-mix(in oklab, var(--rm-muted) 14%, var(--rm-surface));
    border-color: var(--rm-border);
    border-left-color: var(--rm-muted);
    color: var(--rm-muted);
  }
  .docs-main :global(.callout-note strong:first-of-type) {
    color: var(--rm-text, currentColor);
  }
  .docs-main :global(.callout-pitfall) {
    background: color-mix(in oklab, var(--rm-warning, #b45309) 12%, var(--rm-surface));
    border-color: color-mix(in oklab, var(--rm-warning, #b45309) 40%, transparent);
    border-left-color: var(--rm-warning, #b45309);
    border-left-width: 4px;
    color: var(--rm-muted);
    font-weight: var(--font-medium);
  }
  .docs-main :global(.callout-pitfall strong) {
    color: var(--rm-warning, #b45309);
  }
  .docs-main :global(.callout-security) {
    background: color-mix(in oklab, var(--rm-danger, #b91c1c) 12%, var(--rm-surface));
    border-color: color-mix(in oklab, var(--rm-danger, #b91c1c) 40%, transparent);
    border-left-color: var(--rm-danger, #b91c1c);
    border-left-width: 4px;
    color: var(--rm-muted);
    font-weight: var(--font-medium);
  }
  .docs-main :global(.callout-security strong) {
    color: var(--rm-danger, #b91c1c);
  }
</style>
