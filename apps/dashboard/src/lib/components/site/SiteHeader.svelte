<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import UserMenu from "$lib/components/UserMenu.svelte";
  import { page } from "$app/stores";

  export let active: "keys" | "docs" | "use-cases" | "integrations" | "dashboard" | null = null;
  $: portalUrl = developerPortalUrl();
  export let rightText: string | null = null;
  export let rightHref: string | null = null;
  export let user: { uid: string; email?: string | null; name?: string | null } | null = null;

  let mobileOpen = false;
  $: if ($page.url.pathname) mobileOpen = false;

  function toggleMobileMenu() {
    mobileOpen = !mobileOpen;
  }

  function closeMobileMenu() {
    mobileOpen = false;
  }
</script>

<header class="site-header">
  <nav class="site-header-inner" aria-label="Main">
    <a href="/keys" class="logo-link" aria-label="Restormel home">
      <img src="/restormel-lockup-nav.svg" alt="" class="logo-img" />
    </a>

    <ul class="site-header-links">
      <li><a href="/keys" class:active={active === "keys"}>Keys</a></li>
      <li><a href="/keys/docs" class:active={active === "docs"}>Documentation</a></li>
      <li><a href="/keys/use-cases" class:active={active === "use-cases"}>Use cases</a></li>
      <li><a href="/integrations" class:active={active === "integrations"}>Integrations</a></li>
      <li>
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Opens in a new tab"
          aria-label="API portal, opens in new tab"
        >API portal</a>
      </li>
      <li><a href={DASHBOARD_BASE} class:active={active === "dashboard"}>Dashboard</a></li>
    </ul>

    <div class="site-header-right">
      {#if user}
        <UserMenu {user} align="right" />
      {:else if rightText && rightHref}
        <a class="site-header-cta" href={rightHref}>{rightText}</a>
      {:else if rightText}
        <span class="site-header-right-text">{rightText}</span>
      {:else}
        <a class="site-header-cta" href={DASHBOARD_BASE + "/login"}>Sign in</a>
      {/if}
    </div>

    <button
      type="button"
      class="site-header-mobile-toggle"
      aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={mobileOpen}
      aria-controls="site-mobile-menu"
      on:click={toggleMobileMenu}
    >
      <span class="site-header-mobile-icon" aria-hidden="true">{mobileOpen ? "✕" : "☰"}</span>
      <span class="site-header-mobile-label">Menu</span>
    </button>
  </nav>

  {#if mobileOpen}
    <div class="site-header-mobile-backdrop" aria-hidden="true" on:click={closeMobileMenu}></div>
  {/if}

  <div class="site-header-mobile-menu" id="site-mobile-menu" class:site-header-mobile-menu-open={mobileOpen}>
    <a href="/keys" class:active={active === "keys"} on:click={closeMobileMenu}>Keys</a>
    <a href="/keys/docs" class:active={active === "docs"} on:click={closeMobileMenu}>Documentation</a>
    <a href="/keys/use-cases" class:active={active === "use-cases"} on:click={closeMobileMenu}>Use cases</a>
    <a href="/integrations" class:active={active === "integrations"} on:click={closeMobileMenu}>Integrations</a>
    <a
      href={portalUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Opens in a new tab"
      aria-label="API portal, opens in new tab"
      on:click={closeMobileMenu}>API portal</a>
    <a href={DASHBOARD_BASE} class:active={active === "dashboard"} on:click={closeMobileMenu}>Dashboard</a>
    <div class="site-header-mobile-divider" aria-hidden="true"></div>
    {#if user}
      <a href="/keys/pricing" on:click={closeMobileMenu}>Pricing</a>
      <a href={DASHBOARD_BASE + "/settings"} on:click={closeMobileMenu}>Profile &amp; settings</a>
      <a href={DASHBOARD_BASE + "/billing"} on:click={closeMobileMenu}>Subscription</a>
      <a href={DASHBOARD_BASE + "/logout"} data-sveltekit-reload on:click={closeMobileMenu}>Sign out</a>
    {:else if rightText && rightHref}
      <a href={rightHref} on:click={closeMobileMenu}>{rightText}</a>
    {:else}
      <a href={DASHBOARD_BASE + "/login"} on:click={closeMobileMenu}>Sign in</a>
    {/if}
  </div>
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
  .site-header-mobile-toggle {
    display: none;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-text);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    min-width: 44px;
    min-height: 44px;
  }
  .site-header-mobile-toggle:hover {
    background: var(--rm-surface-raised);
  }
  .site-header-mobile-toggle:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }
  .site-header-mobile-icon {
    font-size: var(--text-sm);
    line-height: 1;
  }
  .site-header-mobile-label {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .site-header-mobile-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: calc(var(--z-modal) - 1);
  }
  .site-header-mobile-menu {
    display: none;
    position: relative;
    z-index: var(--z-modal);
    padding: var(--space-3) var(--space-6) var(--space-4);
    border-top: 1px solid var(--rm-border);
    background: var(--rm-surface);
    gap: var(--space-2);
    flex-direction: column;
  }
  .site-header-mobile-menu a {
    display: block;
    color: var(--rm-muted);
    font-size: var(--text-sm);
    text-decoration: none;
    padding: var(--space-2) var(--space-2);
    border-radius: var(--rm-radius);
    min-height: 44px;
    align-content: center;
  }
  .site-header-mobile-menu a:hover {
    background: var(--rm-sage-bg);
    color: var(--rm-sage);
    text-decoration: none;
  }
  .site-header-mobile-menu a.active {
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .site-header-mobile-divider {
    height: 1px;
    background: var(--rm-border);
    margin: var(--space-1) 0;
  }
  @media (max-width: 760px) {
    .site-header-inner {
      padding: var(--space-3) var(--space-4);
      gap: var(--space-3);
    }
    .site-header-links,
    .site-header-right {
      display: none;
    }
    .site-header-mobile-toggle {
      display: inline-flex;
    }
    .site-header-mobile-menu-open {
      display: flex;
    }
  }
</style>

