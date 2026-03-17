<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let active: "keys" | "docs" | "pricing" | "dashboard" | null = null;
  export let rightText: string | null = null;
  export let rightHref: string | null = null;
  export let onToggleSidebar: (() => void) | null = null;
  export let sidebarExpanded: boolean | null = null;
</script>

<header class="site-header">
  <nav class="site-header-inner" aria-label="Main">
    <div class="site-header-left">
      {#if onToggleSidebar}
        <button
          type="button"
          class="sidebar-toggle"
          aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={sidebarExpanded ?? false}
          on:click={() => onToggleSidebar?.()}
        >
          <span aria-hidden="true">{sidebarExpanded ? "▾" : "▸"}</span>
        </button>
      {/if}
      <a href="/" class="logo">
        <img src="/restormel-lockup-nav.svg" alt="Restormel" class="logo-img" style="height: 28px; width: auto;" />
      </a>
    </div>

    <ul class="site-header-links">
      <li><a href="/keys" class:active={active === "keys"}>Keys</a></li>
      <li><a href="/keys/docs" class:active={active === "docs"}>Docs</a></li>
      <li><a href="/keys/pricing" class:active={active === "pricing"}>Pricing</a></li>
      <li><a href={DASHBOARD_BASE} class:active={active === "dashboard"}>Dashboard</a></li>
    </ul>

    <div class="site-header-right">
      {#if rightText && rightHref}
        <a class="site-header-right-link" href={rightHref}>{rightText}</a>
      {:else if rightText}
        <span class="site-header-right-text">{rightText}</span>
      {/if}
    </div>
  </nav>
</header>

<style>
  .site-header {
    border-bottom: 1px solid var(--rm-border);
    background: var(--rm-surface);
    min-height: var(--rm-nav-height);
  }
  .site-header-inner {
    max-width: var(--rm-container-max);
    margin: 0 auto;
    padding: var(--space-4) var(--space-6);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    min-height: var(--rm-nav-height);
  }
  .site-header-left {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
  }
  .sidebar-toggle {
    width: 2rem;
    height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-muted);
    cursor: pointer;
  }
  .sidebar-toggle:hover {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
  }
  .logo {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    transition: opacity var(--duration-fast) var(--ease);
  }
  .logo:hover {
    opacity: 0.9;
  }
  .logo:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--rm-radius);
  }
  .logo-img {
    display: block;
    object-fit: contain;
  }
  .site-header-links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
  }
  .site-header-links a {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
    padding: var(--space-2) 0;
    transition: color var(--duration-fast) var(--ease);
  }
  .site-header-links a:hover {
    color: var(--rm-sage);
  }
  .site-header-links a.active {
    color: var(--rm-text);
    text-decoration: none;
    font-weight: var(--font-medium);
  }
  .site-header-right {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 10rem;
  }
  .site-header-right-link {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .site-header-right-link:hover {
    color: var(--rm-sage);
    text-decoration: none;
  }
  .site-header-right-text {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    max-width: 16rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

