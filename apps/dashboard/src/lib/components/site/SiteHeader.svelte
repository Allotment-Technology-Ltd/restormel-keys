<script lang="ts">
  import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";
  import UserMenu from "$lib/components/UserMenu.svelte";
  import RestormelLogo from "$lib/components/RestormelLogo.svelte";
  import {
    companyNavLinks,
    isCompanyNavActive,
    isIntegrationsActive,
    isLinkActive,
    isProductNavActive,
    normalizePath,
    productNavLinks,
  } from "$lib/site-nav";

  export let rightText: string | null = null;
  export let rightHref: string | null = null;
  export let user: { uid: string; email?: string | null; name?: string | null; isServiceAdmin?: boolean } | null =
    null;
  /** Current path from parent layout (`$page.url.pathname`). */
  export let pathname = "/";

  let mobileOpen = false;
  let productOpen = false;
  let companyOpen = false;

  $: path = pathname.replace(/\/$/, "") || "/";
  $: if (pathname) {
    mobileOpen = false;
    productOpen = false;
    companyOpen = false;
  }

  $: productNavOn = isProductNavActive(path);
  $: integrationsOn = isIntegrationsActive(path);
  $: companyNavOn = isCompanyNavActive(path);
  $: isDashboardActive = path.startsWith(DASHBOARD_BASE);

  function toggleMobileMenu() {
    mobileOpen = !mobileOpen;
  }

  function closeMobileMenu() {
    mobileOpen = false;
  }

  function onProductToggle(e: Event) {
    const el = e.currentTarget as HTMLDetailsElement;
    if (el.open) {
      companyOpen = false;
    }
  }

  function onCompanyToggle(e: Event) {
    const el = e.currentTarget as HTMLDetailsElement;
    if (el.open) {
      productOpen = false;
    }
  }

  function linkActive(href: string): boolean {
    return isLinkActive(path, href);
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && mobileOpen) {
      e.preventDefault();
      mobileOpen = false;
    }
  }
</script>

<svelte:window on:keydown={onWindowKeydown} />

<header class="site-header">
  <nav class="site-header-inner" aria-label="Main">
    <a href="/" class="logo-link" aria-label="Restormel home">
      <RestormelLogo variant="lockup" height={32} decorative />
    </a>

    <ul class="site-header-links">
      <li class="nav-dropdown-wrap">
        <details class="nav-details" bind:open={productOpen} on:toggle={onProductToggle}>
          <summary
            id="site-nav-summary-product"
            class="nav-summary"
            class:nav-summary-active={productNavOn}
            aria-controls="site-nav-panel-product"
          >
            Product
          </summary>
          <div
            id="site-nav-panel-product"
            class="nav-dropdown-panel"
            role="region"
            aria-labelledby="site-nav-summary-product"
          >
            {#each productNavLinks as item}
              <a
                href={item.href}
                class:active={linkActive(item.href)}
                aria-current={linkActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </a>
            {/each}
          </div>
        </details>
      </li>
      <li>
        <a
          href="/integrations"
          class:active={integrationsOn}
          aria-current={integrationsOn ? "page" : undefined}
        >
          Integrations
        </a>
      </li>
      <li class="nav-dropdown-wrap">
        <details class="nav-details" bind:open={companyOpen} on:toggle={onCompanyToggle}>
          <summary
            id="site-nav-summary-company"
            class="nav-summary"
            class:nav-summary-active={companyNavOn}
            aria-controls="site-nav-panel-company"
          >
            Company
          </summary>
          <div
            id="site-nav-panel-company"
            class="nav-dropdown-panel"
            role="region"
            aria-labelledby="site-nav-summary-company"
          >
            {#each companyNavLinks as item}
              <a
                href={item.href}
                class:active={linkActive(item.href)}
                aria-current={linkActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </a>
            {/each}
          </div>
        </details>
      </li>
      <li>
        <a
          href={DASHBOARD_BASE + "/home"}
          class:active={isDashboardActive}
          aria-current={isDashboardActive ? "page" : undefined}
        >
          Dashboard
        </a>
      </li>
    </ul>

    <div class="site-header-right">
      {#if user}
        <UserMenu {user} align="right" />
      {:else if rightText && rightHref}
        <a class="btn btn-primary" href={rightHref}>{rightText}</a>
      {:else if rightText}
        <span class="site-header-right-text">{rightText}</span>
      {:else}
        <a class="btn btn-ghost" href={DASHBOARD_BASE + "/login"}>Sign in</a>
        <a class="btn btn-primary" href="/founders#apply-heading">Early access →</a>
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
    <button type="button" class="site-header-mobile-backdrop" aria-label="Close menu" on:click={closeMobileMenu}
    ></button>
  {/if}

  <div class="site-header-mobile-menu" id="site-mobile-menu" class:site-header-mobile-menu-open={mobileOpen}>
    <span class="site-header-mobile-heading" role="presentation">Product</span>
    {#each productNavLinks as item}
      <a
        href={item.href}
        class:active={linkActive(item.href)}
        aria-current={linkActive(item.href) ? "page" : undefined}
        on:click={closeMobileMenu}>{item.label}</a>
    {/each}
    <span class="site-header-mobile-heading" role="presentation">Integrations</span>
    <a
      href="/integrations"
      class:active={integrationsOn}
      aria-current={integrationsOn ? "page" : undefined}
      on:click={closeMobileMenu}>Overview</a>
    <span class="site-header-mobile-heading" role="presentation">Company</span>
    {#each companyNavLinks as item}
      <a
        href={item.href}
        class:active={linkActive(item.href)}
        aria-current={linkActive(item.href) ? "page" : undefined}
        on:click={closeMobileMenu}>{item.label}</a>
    {/each}
    <span class="site-header-mobile-heading" role="presentation">Dashboard</span>
    <a
      href={DASHBOARD_BASE + "/home"}
      class:active={isDashboardActive}
      aria-current={isDashboardActive ? "page" : undefined}
      on:click={closeMobileMenu}>Open dashboard</a>
    <div class="site-header-mobile-divider" aria-hidden="true"></div>
    {#if user}
      <a href="/founders" on:click={closeMobileMenu}>Early access</a>
      {#if user.isServiceAdmin}
        <a href={ADMIN_BASE + "/users"} on:click={closeMobileMenu}>Admin</a>
      {/if}
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
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
    border-bottom: var(--border);
    background: var(--color-bg);
    min-height: 3.5rem;
  }
  .site-header-inner {
    max-width: 75rem;
    margin: 0 auto;
    padding: 0 var(--space-8);
    display: flex;
    align-items: stretch;
    gap: 0;
    min-height: 3.5rem;
  }
  .logo-link {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
    padding-right: var(--space-4);
    align-self: center;
  }
  .logo-link:hover {
    transform: none;
  }
  .logo-link:focus-visible {
    outline: var(--brut-border-width) solid var(--brut-ink);
    outline-offset: 2px;
    border-radius: 0;
  }
  .site-header-links {
    list-style: none;
    margin: 0 0 0 auto;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 0;
  }
  .site-header-links > li {
    display: flex;
    align-items: stretch;
    border-left: var(--border);
  }
  .site-header-links > li > a {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-ink);
    text-decoration: none;
    padding: 0 1rem;
    min-height: 3.5rem;
    display: inline-flex;
    align-items: center;
    border-bottom: 2px solid transparent;
    transition: border-color 100ms ease, color 100ms ease;
  }
  .site-header-links > li > a:hover {
    background: transparent;
    color: var(--color-ink);
    border-bottom-color: var(--color-ink);
  }
  .site-header-links > li > a.active {
    color: var(--color-ink);
    font-weight: 800;
    background: transparent;
    border-bottom-color: var(--color-ink);
  }
  .nav-dropdown-wrap {
    position: relative;
  }
  .nav-details {
    position: relative;
  }
  .nav-summary {
    list-style: none;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-ink);
    cursor: pointer;
    padding: 0 1rem;
    min-height: 3.5rem;
    display: flex;
    align-items: center;
    border-bottom: 2px solid transparent;
    transition: border-color 100ms ease;
  }
  .nav-summary::-webkit-details-marker {
    display: none;
  }
  .nav-summary::after {
    content: " ▾";
    font-size: 0.65em;
    opacity: 0.75;
  }
  .nav-summary:hover {
    background: transparent;
    color: var(--color-ink);
    border-bottom-color: var(--color-ink);
  }
  .nav-summary-active {
    color: var(--color-ink);
    font-weight: 800;
    background: transparent;
    border-bottom-color: var(--color-ink);
  }
  .nav-dropdown-panel {
    position: absolute;
    top: calc(100% + var(--space-1));
    left: 0;
    min-width: 12rem;
    padding: var(--space-2);
    background: var(--color-surface);
    border: var(--border);
    border-radius: 0;
    box-shadow: var(--shadow-md);
    z-index: calc(var(--z-sticky) + 2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .nav-dropdown-panel a {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    color: var(--color-ink-muted);
    text-decoration: none;
    padding: var(--space-2) var(--space-3);
    border-radius: 0;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  .nav-dropdown-panel a:hover {
    background: var(--color-yellow);
    color: var(--color-ink);
    text-decoration: none;
  }
  .nav-dropdown-panel a.active {
    color: var(--color-ink);
    font-weight: 800;
    background: var(--color-yellow);
  }
  .site-header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
    padding-left: var(--space-3);
    margin-left: var(--space-2);
  }

  .site-header-right :global(.btn-primary) {
    box-shadow: 3px 3px 0 var(--color-yellow);
  }

  .site-header-right :global(.btn-primary:hover) {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--color-yellow);
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
    border: var(--border);
    background: var(--color-yellow);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-weight: 700;
    border-radius: 0;
    box-shadow: var(--shadow-sm);
    padding: var(--space-2) var(--space-3);
    min-width: 44px;
    min-height: 44px;
  }
  .site-header-mobile-toggle:hover {
    background: var(--brut-neon);
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
    margin: 0;
    padding: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: calc(var(--z-modal) - 1);
    cursor: pointer;
  }
  .site-header-mobile-menu {
    display: none;
    position: relative;
    z-index: var(--z-modal);
    padding: var(--space-3) var(--space-6) var(--space-4);
    border-top: var(--border);
    background: var(--color-surface);
    gap: var(--space-2);
    flex-direction: column;
  }
  .site-header-mobile-menu a {
    display: block;
    color: var(--rm-muted);
    font-size: var(--text-sm);
    text-decoration: none;
    padding: var(--space-2) var(--space-2);
    border-radius: 0;
    min-height: 44px;
    align-content: center;
  }
  .site-header-mobile-menu a:hover {
    background: var(--color-yellow);
    color: var(--color-ink);
    text-decoration: none;
  }
  .site-header-mobile-menu a.active {
    color: var(--color-ink);
    font-weight: 800;
    background: var(--color-yellow);
  }
  .site-header-mobile-heading {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--rm-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: var(--space-2);
    margin-bottom: calc(-1 * var(--space-1));
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
