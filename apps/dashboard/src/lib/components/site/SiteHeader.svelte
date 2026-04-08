<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import UserMenu from "$lib/components/UserMenu.svelte";
  import { page } from "$app/stores";
  import {
    developerLinks,
    isIntegrationsActive,
    isKeysPillarActive,
    isLinkActive,
    isTestingPillarActive,
    keysPillarLinks,
    testingPillarLinks,
  } from "$lib/site-nav";

  $: portalUrl = developerPortalUrl();
  $: devLinks = developerLinks(portalUrl);

  export let rightText: string | null = null;
  export let rightHref: string | null = null;
  export let user: { uid: string; email?: string | null; name?: string | null } | null = null;

  let mobileOpen = false;
  let keysOpen = false;
  let testingOpen = false;
  let developersOpen = false;

  $: path = $page.url.pathname.replace(/\/$/, "") || "/";
  $: if ($page.url.pathname) {
    mobileOpen = false;
    keysOpen = false;
    testingOpen = false;
    developersOpen = false;
  }

  $: keysPillarOn = isKeysPillarActive(path);
  $: testingPillarOn = isTestingPillarActive(path);
  $: integrationsOn = isIntegrationsActive(path);

  function toggleMobileMenu() {
    mobileOpen = !mobileOpen;
  }

  function closeMobileMenu() {
    mobileOpen = false;
  }

  function onKeysToggle(e: Event) {
    const el = e.currentTarget as HTMLDetailsElement;
    if (el.open) {
      testingOpen = false;
      developersOpen = false;
    }
  }

  function onTestingToggle(e: Event) {
    const el = e.currentTarget as HTMLDetailsElement;
    if (el.open) {
      keysOpen = false;
      developersOpen = false;
    }
  }

  function onDevelopersToggle(e: Event) {
    const el = e.currentTarget as HTMLDetailsElement;
    if (el.open) {
      keysOpen = false;
      testingOpen = false;
    }
  }

  function linkActive(href: string): boolean {
    return isLinkActive(path, href);
  }
</script>

<header class="site-header">
  <nav class="site-header-inner" aria-label="Main">
    <a href="/" class="logo-link" aria-label="Restormel home">
      <img src="/restormel-lockup-nav.svg" alt="" class="logo-img" />
    </a>

    <ul class="site-header-links">
      <li class="nav-dropdown-wrap">
        <details class="nav-details" bind:open={keysOpen} on:toggle={onKeysToggle}>
          <summary class="nav-summary" class:nav-summary-active={keysPillarOn}>Keys</summary>
          <div class="nav-dropdown-panel" role="group" aria-label="Keys">
            {#each keysPillarLinks as item}
              <a href={item.href} class:active={linkActive(item.href)}>{item.label}</a>
            {/each}
          </div>
        </details>
      </li>
      <li class="nav-dropdown-wrap">
        <details class="nav-details" bind:open={testingOpen} on:toggle={onTestingToggle}>
          <summary class="nav-summary" class:nav-summary-active={testingPillarOn}>Testing</summary>
          <div class="nav-dropdown-panel" role="group" aria-label="Testing">
            {#each testingPillarLinks as item}
              <a href={item.href} class:active={linkActive(item.href)}>{item.label}</a>
            {/each}
          </div>
        </details>
      </li>
      <li>
        <a href="/integrations" class:active={integrationsOn}>Integrations</a>
      </li>
      <li class="nav-dropdown-wrap">
        <details class="nav-details" bind:open={developersOpen} on:toggle={onDevelopersToggle}>
          <summary class="nav-summary">Developers</summary>
          <div class="nav-dropdown-panel" role="group" aria-label="Developers">
            {#each devLinks as item}
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                title="Opens in a new tab"
                aria-label={item.ariaLabel ?? `${item.label}, opens in new tab`}
              >
                {item.label}
              </a>
            {/each}
          </div>
        </details>
      </li>
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
    <button type="button" class="site-header-mobile-backdrop" aria-label="Close menu" on:click={closeMobileMenu}
    ></button>
  {/if}

  <div class="site-header-mobile-menu" id="site-mobile-menu" class:site-header-mobile-menu-open={mobileOpen}>
    <span class="site-header-mobile-heading" role="presentation">Keys</span>
    {#each keysPillarLinks as item}
      <a href={item.href} class:active={linkActive(item.href)} on:click={closeMobileMenu}>{item.label}</a>
    {/each}
    <span class="site-header-mobile-heading" role="presentation">Testing</span>
    {#each testingPillarLinks as item}
      <a href={item.href} class:active={linkActive(item.href)} on:click={closeMobileMenu}>{item.label}</a>
    {/each}
    <span class="site-header-mobile-heading" role="presentation">Integrations</span>
    <a href="/integrations" class:active={integrationsOn} on:click={closeMobileMenu}>Overview</a>
    <span class="site-header-mobile-heading" role="presentation">Developers</span>
    {#each devLinks as item}
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        title="Opens in a new tab"
        aria-label={item.ariaLabel ?? `${item.label}, opens in new tab`}
        on:click={closeMobileMenu}>{item.label}</a>
    {/each}
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
    gap: var(--space-4);
    margin-left: auto;
    align-items: center;
  }
  .site-header-links > li > a {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
    padding: var(--space-2) 0;
    transition: color 0.15s ease;
  }
  .site-header-links > li > a:hover {
    color: var(--rm-sage);
  }
  .site-header-links > li > a.active {
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .nav-dropdown-wrap {
    position: relative;
  }
  .nav-details {
    position: relative;
  }
  .nav-summary {
    list-style: none;
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    cursor: pointer;
    padding: var(--space-2) 0;
    transition: color 0.15s ease;
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
    color: var(--rm-sage);
  }
  .nav-summary-active {
    color: var(--rm-text);
    font-weight: var(--font-medium);
  }
  .nav-dropdown-panel {
    position: absolute;
    top: calc(100% + var(--space-1));
    left: 0;
    min-width: 12rem;
    padding: var(--space-2);
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    box-shadow: var(--rm-card-shadow, 0 8px 24px rgba(0, 0, 0, 0.2));
    z-index: calc(var(--z-sticky) + 2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .nav-dropdown-panel a {
    font-family: var(--rm-font-ui);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
  }
  .nav-dropdown-panel a:hover {
    background: var(--rm-sage-bg);
    color: var(--rm-sage);
    text-decoration: none;
  }
  .nav-dropdown-panel a.active {
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
  .site-header-mobile-heading {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
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
