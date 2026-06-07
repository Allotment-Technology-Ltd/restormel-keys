<script lang="ts">
  import { NAV_GROUPS, filterWorkNavForModuleFlags, isWorkNavActive, defaultNavGroupsOpen } from "$lib/nav-config";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import BrutalBadge from "./BrutalBadge.svelte";
  import RestormelLogo from "$lib/components/RestormelLogo.svelte";

  export let title = "Today";
  export let activePath = "/prototype/brutalist-dashboard";

  const workNavItems = filterWorkNavForModuleFlags(MVP_MODULE_DEFAULTS);

  let collapsed = false;
  let navOpen: Record<string, boolean> = defaultNavGroupsOpen();

  function toggleSidebar() {
    collapsed = !collapsed;
  }

  function toggleGroup(id: string) {
    navOpen = { ...navOpen, [id]: !navOpen[id] };
  }

  function isActive(href: string): boolean {
    if (activePath === "/prototype/brutalist-dashboard") {
      return href === workNavItems[0]?.href;
    }
    return isWorkNavActive(activePath, href) || (activePath === href || activePath.startsWith(href + "/"));
  }
</script>

<div class="brutal-shell" class:brutal-shell-collapsed={collapsed}>
  <aside class="brutal-sidebar" aria-label="Dashboard navigation">
    <div class="brutal-sidebar-brand">
      <a href="/prototype/brutalist-dashboard" class="brutal-logo brut-focus" aria-label="Restormel prototype home">
        <RestormelLogo variant={collapsed ? "mark" : "lockup"} height={28} accent={!collapsed} decorative />
      </a>
      {#if !collapsed}
        <BrutalBadge variant="neon" label="PROTOTYPE" />
      {/if}
    </div>

    <nav class="brutal-nav" aria-label="Dashboard">
      <div class="brutal-project-pill" title="Demo project">
        {#if collapsed}
          <span aria-hidden="true">PRJ</span>
        {:else}
          <span class="brutal-project-label">PROJECT</span>
          <strong>sophia-demo · staging</strong>
        {/if}
      </div>

      {#each workNavItems as item}
        <a
          href={item.href}
          class="brutal-nav-link"
          class:brutal-nav-link-active={isActive(item.href)}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          {#if collapsed}◆{:else}{item.label}{/if}
        </a>
      {/each}

      {#each NAV_GROUPS as group}
        <section class="brutal-nav-group" aria-labelledby="brutal-nav-{group.id}">
          <button
            type="button"
            id="brutal-nav-{group.id}"
            class="brutal-nav-group-header brut-focus"
            aria-expanded={navOpen[group.id]}
            on:click={() => toggleGroup(group.id)}
          >
            {#if !collapsed}
              <span>{group.label}</span>
              <span aria-hidden="true">{navOpen[group.id] ? "−" : "+"}</span>
            {:else}
              <span aria-hidden="true">▤</span>
            {/if}
          </button>
          {#if navOpen[group.id] && !collapsed}
            <div class="brutal-nav-group-links" role="group" aria-label={group.label}>
              {#each group.items as item}
                <a href={item.href} class="brutal-nav-link" class:brutal-nav-link-active={isActive(item.href)}>
                  {item.label}
                </a>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </nav>

    <div class="brutal-sidebar-footer">
      <button
        type="button"
        class="brutal-sidebar-toggle brut-pressable brut-focus"
        aria-pressed={collapsed}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        on:click={toggleSidebar}
      >
        {collapsed ? "▶" : "◀ COLLAPSE"}
      </button>
    </div>
  </aside>

  <div class="brutal-main-wrap">
    <header class="brutal-topbar">
      <div class="brutal-topbar-left">
        <button
          type="button"
          class="brutal-topbar-toggle brut-pressable brut-focus"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          on:click={toggleSidebar}
        >
          {collapsed ? "▶ NAV" : "◀ NAV"}
        </button>
        <h1 class="brutal-topbar-title">{title}</h1>
      </div>
      <nav class="brutal-topbar-nav" aria-label="Suite products">
        <span class="brutal-topbar-pill brut-fill-neon">KEYS</span>
        <a href="/keys/docs" class="brutal-topbar-link brut-focus">DOCS</a>
        <a href="/keys/dashboard/testing" class="brutal-topbar-link brut-focus">TESTING</a>
        <a href="/keys/dashboard/connect" class="brutal-topbar-link brut-focus">KNOWLEDGE</a>
        <a href="/keys/dashboard/graph" class="brutal-topbar-link brut-focus">GRAPH</a>
      </nav>
    </header>

    <div class="brutal-prototype-banner" role="status">
      <strong>DESIGN PROTOTYPE</strong>
      <span class="brut-muted">Neo-brutalist dashboard preview — not production UI.</span>
      <a href="/keys/dashboard" class="brutal-banner-link brut-focus">← Live dashboard</a>
    </div>

    <main class="brutal-main" id="main-content">
      <slot />
    </main>
  </div>
</div>

<style>
  .brutal-shell {
    display: flex;
    min-height: 100vh;
    max-width: 90rem;
    margin: 0 auto;
    border: var(--brut-border-width) solid var(--brut-ink);
    box-shadow: var(--brut-shadow);
    background: var(--brut-canvas);
  }

  .brutal-sidebar {
    width: var(--brut-sidebar-width);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-right: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .brutal-shell-collapsed .brutal-sidebar {
    width: var(--brut-sidebar-collapsed);
  }

  .brutal-sidebar-brand {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-bottom: var(--brut-border-width) solid var(--brut-ink);
  }

  .brutal-logo {
    display: flex;
    align-items: center;
    text-decoration: none;
    color: var(--brut-ink);
  }

  .brutal-nav {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .brutal-nav-link {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 0.75rem;
    font-weight: 700;
    text-decoration: none;
    color: var(--brut-ink);
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    transition: var(--brut-transition);
  }

  .brutal-nav-link:hover {
    background: var(--color-bg-deep);
  }

  .brutal-nav-link-active {
    background: var(--color-ink);
    color: var(--color-surface);
    font-weight: 900;
  }

  .brutal-project-pill {
    margin: 0;
    padding: 0.625rem 0.75rem;
    border-bottom: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-canvas);
    font-size: 0.6875rem;
  }

  .brutal-project-label {
    display: block;
    font-weight: 800;
    letter-spacing: 0.1em;
    margin-bottom: 0.125rem;
  }

  .brutal-nav-group-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding: 0 0.75rem;
    font-family: inherit;
    font-size: inherit;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: var(--brut-canvas);
    border: none;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    cursor: pointer;
  }

  .brutal-nav-group-links .brutal-nav-link {
    padding-left: 1.25rem;
    font-weight: 600;
    font-size: 0.75rem;
  }

  .brutal-sidebar-footer {
    padding: 0.75rem;
    border-top: var(--brut-border-width) solid var(--brut-ink);
  }

  .brutal-sidebar-toggle {
    width: 100%;
    min-height: 44px;
    font-family: inherit;
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    background: var(--brut-canvas);
    color: var(--brut-ink);
  }

  .brutal-main-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .brutal-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: var(--brut-topbar-height);
    padding: 0 1rem;
    border-bottom: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    flex-wrap: wrap;
  }

  .brutal-topbar-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .brutal-topbar-toggle {
    min-height: 36px;
    padding: 0.25rem 0.625rem;
    font-family: inherit;
    font-size: 0.6875rem;
    font-weight: 800;
    background: var(--color-surface);
    border: var(--border);
    color: var(--brut-ink);
  }

  .brutal-topbar-title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
  }

  .brutal-topbar-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .brutal-topbar-pill {
    padding: 0.125rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    border: var(--brut-border-micro) solid var(--brut-ink);
  }

  .brutal-topbar-link {
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-decoration: none;
    color: var(--brut-ink);
    padding: 0.25rem 0.375rem;
    border: var(--brut-border-micro) solid transparent;
  }

  .brutal-topbar-link:hover {
    border-color: var(--brut-ink);
    background: var(--brut-canvas);
  }

  .brutal-prototype-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.5rem 1rem;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--color-ink);
    color: var(--color-surface);
    font-size: 0.6875rem;
    font-weight: 700;
  }

  .brutal-banner-link {
    margin-left: auto;
    font-weight: 900;
    text-decoration: underline;
    color: var(--color-yellow);
  }

  .brutal-main {
    flex: 1;
    padding: var(--space-6);
    background: var(--brut-canvas);
  }

  @media (max-width: 760px) {
    .brutal-shell {
      flex-direction: column;
    }

    .brutal-sidebar {
      width: 100%;
      border-right: none;
      border-bottom: var(--brut-border-width) solid var(--brut-ink);
    }

    .brutal-shell-collapsed .brutal-sidebar {
      width: 100%;
    }
  }
</style>
