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
</style>
