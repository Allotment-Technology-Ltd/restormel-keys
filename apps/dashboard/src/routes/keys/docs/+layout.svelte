<script lang="ts">
  /** Docs layout — Phase C will add sidebar and full content. */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
</script>

<svelte:head>
  <title>Docs — Restormel Keys</title>
</svelte:head>

<div class="docs-shell">
  <nav class="docs-nav">
    <a href="/keys">Keys</a>
    <a href="/keys/docs">Overview</a>
    <a href="/keys/docs/walkthrough">Walkthrough</a>
    <a href="/keys/docs/compatibility">Compatibility</a>
    <a href="/keys/docs/cloud-api">Cloud API</a>
    <a href={DASHBOARD_BASE}>Dashboard</a>
    <a href={DASHBOARD_BASE + "/login"}>Sign in</a>
  </nav>
  <main class="docs-main">
    <slot />
  </main>
</div>

<style>
  .docs-shell {
    display: flex;
    min-height: 100vh;
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
  .docs-nav a {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .docs-main {
    flex: 1;
    padding: var(--space-6);
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
