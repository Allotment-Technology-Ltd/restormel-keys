<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let active: "keys" | "docs" | "pricing" | "dashboard" | null = null;
  export let rightText: string | null = null;
  export let rightHref: string | null = null;
</script>

<header class="site-header">
  <nav class="site-header-inner" aria-label="Main">
    <a href="/keys" class="logo-link" aria-label="Restormel home">
      <img src="/restormel-lockup-nav.svg" alt="" class="logo-img" />
    </a>

    <ul class="site-header-links">
      <li><a href="/keys" class:active={active === "keys"}>Keys</a></li>
      <li><a href="/keys/docs" class:active={active === "docs"}>Docs</a></li>
      <li><a href="/keys/pricing" class:active={active === "pricing"}>Pricing</a></li>
      <li><a href={DASHBOARD_BASE} class:active={active === "dashboard"}>Dashboard</a></li>
    </ul>

    <div class="site-header-right">
      {#if rightText && rightHref}
        <a class="site-header-cta" href={rightHref}>{rightText}</a>
      {:else if rightText}
        <span class="site-header-right-text">{rightText}</span>
      {:else}
        <a class="site-header-cta" href={DASHBOARD_BASE + "/login"}>Sign in</a>
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
    padding: var(--space-3) var(--space-6);
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-height: var(--rm-nav-height);
  }
  .logo-link {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
    transition: opacity 0.15s ease;
  }
  .logo-link:hover {
    opacity: 0.88;
  }
  .logo-link:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
    border-radius: var(--rm-radius);
  }
  .logo-img {
    display: block;
    height: 2rem;
    width: auto;
    object-fit: contain;
  }
  .site-header-links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    margin-left: auto;
  }
  .site-header-links a {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
    padding: var(--space-2) 0;
    transition: color 0.15s ease;
  }
  .site-header-links a:hover {
    color: var(--rm-sage);
  }
  .site-header-links a.active {
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .site-header-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
  }
  .site-header-cta {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--rm-sage);
    text-decoration: none;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    transition: color 0.15s ease, background 0.15s ease;
  }
  .site-header-cta:hover {
    color: var(--rm-text);
    background: color-mix(in oklab, var(--rm-sage) 12%, transparent);
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

