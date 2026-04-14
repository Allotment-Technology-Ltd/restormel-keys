<script lang="ts">
  import "../../../app.css";
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { NAV_GROUPS, OVERVIEW_ITEM, topbarTitle } from "$lib/nav-config";
  import { onMount } from "svelte";
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import ProjectContextSwitcher from "$lib/components/dashboard/ProjectContextSwitcher.svelte";
  import FeedbackWidget from "$lib/components/FeedbackWidget.svelte";
  import DashboardJourneyBanner from "$lib/components/dashboard/DashboardJourneyBanner.svelte";
  import { openFeedbackWidget } from "$lib/stores/feedback-widget";

  $: user = $page.data.user;
  $: authError = $page.data.authError ?? null;
  $: isAuthRoute = $page.url.pathname === DASHBOARD_BASE + "/login" || $page.url.pathname === DASHBOARD_BASE + "/logout";
  $: currentPath = $page.url.pathname;
  $: title = topbarTitle(currentPath);
  $: isTestingHub =
    currentPath === DASHBOARD_BASE + "/testing" ||
    currentPath.startsWith(DASHBOARD_BASE + "/testing/");
  $: projectContexts = $page.data.projectContexts ?? [];
  $: navGroupsForLayout = $page.data.navGroupsForUi ?? NAV_GROUPS;
  $: uiHiddenBanner = $page.data.dashboardUiHiddenBanner ?? null;
  $: projectsNavHidden = ($page.data.dashboardUiHidden ?? []).includes("projects");
  $: journeySignals = $page.data.journeySignals ?? null;

  const STORAGE_KEY = "rk_dashboard_sidebar_collapsed";
  const NAV_GROUPS_STORAGE_KEY = "restormel_nav_groups";
  let collapsed = false;
  let isPhone = false;
  let navGroupsOpen: Record<string, boolean> = { build: true, monitor: true, developer: false };

  onMount(() => {
    collapsed = localStorage.getItem(STORAGE_KEY) === "true";
    try {
      const raw = localStorage.getItem(NAV_GROUPS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        navGroupsOpen = {
          build: typeof parsed.build === "boolean" ? parsed.build : true,
          monitor: typeof parsed.monitor === "boolean" ? parsed.monitor : true,
          developer: typeof parsed.developer === "boolean" ? parsed.developer : false,
        };
      }
    } catch {
      navGroupsOpen = { build: true, monitor: true, developer: false };
    }

    const media = window.matchMedia("(max-width: 767px)");
    const updatePhone = () => {
      isPhone = media.matches;
    };
    updatePhone();
    media.addEventListener("change", updatePhone);

    return () => media.removeEventListener("change", updatePhone);
  });

  function toggleSidebar() {
    collapsed = !collapsed;
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }

  function toggleNavGroup(groupId: "build" | "monitor" | "developer") {
    navGroupsOpen = { ...navGroupsOpen, [groupId]: !navGroupsOpen[groupId] };
    localStorage.setItem(NAV_GROUPS_STORAGE_KEY, JSON.stringify(navGroupsOpen));
  }

  function isActivePath(href: string): boolean {
    return currentPath === href || (href !== DASHBOARD_BASE + "/" && currentPath.startsWith(href + "/"));
  }
</script>

<svelte:head>
  <title>{title ? `${title} – Restormel Keys` : "Dashboard – Restormel Keys"}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if isPhone}
  <div class="mobile-gate-wrap">
    <section class="mobile-gate" aria-labelledby="mobile-gate-heading">
      <h1 id="mobile-gate-heading" class="mobile-gate-title">Dashboard is desktop-first</h1>
      <p class="mobile-gate-desc">
        This dashboard is designed for larger screens. For the best setup experience, open it on a desktop or tablet.
      </p>
      <p class="mobile-gate-links">
        <a href="/keys/docs">Open docs</a>
        <span class="mobile-gate-sep">·</span>
        <a href={developerPortalUrl()} target="_blank" rel="noopener noreferrer">API portal</a>
        <span class="mobile-gate-sep">·</span>
        <a href="/keys/pricing">Pricing</a>
      </p>
    </section>
  </div>
{:else if isAuthRoute}
  <slot />
{:else}
  <div class="shell" class:shell-collapsed={collapsed} data-sveltekit-preload-data="hover">
    <aside class="sidebar" aria-label="Dashboard navigation">
      <nav class="nav" aria-label="Dashboard" data-sveltekit-preload-data="hover" data-sveltekit-preload-code="viewport">
        <a
          href={OVERVIEW_ITEM.href}
          class="nav-link nav-link-overview"
          class:nav-link-active={isActivePath(OVERVIEW_ITEM.href)}
          aria-current={isActivePath(OVERVIEW_ITEM.href) ? "page" : undefined}
        >
          {OVERVIEW_ITEM.label}
        </a>

        {#if !projectsNavHidden}
          <ProjectContextSwitcher projects={projectContexts} />
        {/if}

        {#each navGroupsForLayout as group}
          <section class="nav-group" aria-labelledby={`nav-group-label-${group.id}`}>
            <button
              type="button"
              class="nav-group-header"
              id={`nav-group-label-${group.id}`}
              aria-expanded={navGroupsOpen[group.id]}
              aria-controls={`nav-group-links-${group.id}`}
              on:click={() => toggleNavGroup(group.id)}
            >
              <span class="nav-group-label">
                {#if group.id === "developer"}
                  <span aria-hidden="true">⚙</span>
                {/if}
                <span>{group.label}</span>
              </span>
              <span aria-hidden="true">{navGroupsOpen[group.id] ? "▾" : "▸"}</span>
            </button>
            {#if navGroupsOpen[group.id]}
              <div class="nav-group-links" id={`nav-group-links-${group.id}`} role="group" aria-label={group.label}>
                {#each group.items as item}
                  <a
                    href={item.href}
                    class="nav-link"
                    class:nav-link-active={isActivePath(item.href)}
                    aria-current={isActivePath(item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </a>
                {/each}
              </div>
            {/if}
          </section>
        {/each}
      </nav>
      {#if user}
        <div class="feedback-nav-wrap">
          <button type="button" class="feedback-nav-btn" on:click={openFeedbackWidget}>
            <svg viewBox="0 0 24 24" aria-hidden="true" class="feedback-icon">
              <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 16.5H10l-4.6 3.9c-.5.4-1.2 0-1.2-.7v-3.2H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5Zm0 1a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h.8a.5.5 0 0 1 .5.5v2.6L9.4 15.7a.5.5 0 0 1 .3-.1h9.3a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5H5Z" />
            </svg>
            <span>Feedback</span>
          </button>
        </div>
      {/if}
      <div class="sidebar-footer">
        <button
          type="button"
          class="sidebar-nav-toggle"
          aria-pressed={collapsed}
          aria-label={collapsed ? "Expand dashboard navigation" : "Collapse dashboard navigation"}
          on:click={toggleSidebar}
        >
          ◀ {collapsed ? "Expand nav" : "Collapse nav"}
        </button>
      </div>
    </aside>
    <div class="main-wrap">
      <header class="topbar">
        <div class="topbar-left">
          {#if collapsed}
            <button
              type="button"
              class="topbar-nav-toggle"
              aria-pressed={collapsed}
              aria-label="Expand dashboard navigation"
              on:click={toggleSidebar}
            >
              ▶ Expand nav
            </button>
          {:else}
            <button
              type="button"
              class="topbar-nav-toggle"
              aria-pressed={false}
              aria-label="Collapse dashboard navigation for more workspace"
              title="Hide sidebar — more room for editors"
              on:click={toggleSidebar}
            >
              ◀ Hide nav
            </button>
          {/if}
          <span class="topbar-title">{title}</span>
        </div>
        <nav class="topbar-product-nav" aria-label="Product and related docs">
          {#if isTestingHub}
            <span class="topbar-product-pill" title="You are in the Restormel Testing hub">Testing hub</span>
            <a href="/testing/docs" class="topbar-product-link">Testing docs</a>
            <a href="/keys" class="topbar-product-link">Keys</a>
          {:else}
            <span class="topbar-product-pill" title="Restormel Keys control plane">Keys</span>
            <a href="/keys/docs" class="topbar-product-link">Keys docs</a>
            <a href={DASHBOARD_BASE + "/testing"} class="topbar-product-link">Testing hub</a>
          {/if}
        </nav>
      </header>
      <main class="main" data-sveltekit-preload-data="hover">
        {#if !user && !isAuthRoute}
          {#if authError === "session-verifier-not-found"}
            <div class="auth-error" role="alert">
              <p>Sign-in link expired or already used.</p>
              <p class="auth-error-actions">
                <a href={DASHBOARD_BASE + "/logout"} class="auth-error-link" data-sveltekit-reload>Log out</a> to clear any existing session, then
                <a href={DASHBOARD_BASE + "/login"} class="auth-error-link">sign in again</a>.
              </p>
            </div>
          {:else}
            <div class="welcome" role="region" aria-labelledby="welcome-heading">
              <h1 id="welcome-heading" class="welcome-title">Restormel Keys Dashboard</h1>
              <p class="welcome-intro">Control your AI access from one place: create a workspace and project, create an API Key to call the API, connect providers, define rules, and track usage.</p>
              <ol class="welcome-checklist" aria-label="Get started">
                <li><strong>Sign in</strong> with GitHub (button above).</li>
                <li><strong>Workspace</strong> — created automatically. Then <strong>create a project</strong> (one per app).</li>
                <li><strong>Key model:</strong> An <strong>API Key</strong> lets your app call Restormel. A <strong>provider credential</strong> (e.g. OpenAI key) lets Restormel route requests; you can use one or both.</li>
                <li><strong>Billing</strong> — bring your own keys or Restormel-managed, per route.</li>
                <li><strong>Create a Gateway key</strong>, <strong>connect a provider</strong> (Connections), then <strong>create a route</strong> (Routes) for live traffic — or use <strong>Restormel Testing</strong> for CI without routes first.</li>
                <li><strong>First request</strong> (sandbox) → then <strong>Usage & Analytics</strong> and Logs.</li>
              </ol>
              <p class="welcome-links">
                <a href="/keys/docs/">Docs</a>
                <span class="welcome-sep">·</span>
                <a href={developerPortalUrl()} target="_blank" rel="noopener noreferrer">API portal</a>
                <span class="welcome-sep">·</span>
                <a href="/keys/pricing">Pricing</a>
              </p>
            </div>
          {/if}
        {:else}
          {#if uiHiddenBanner}
            <div class="ui-hidden-banner" role="status">
              <p>
                <strong>{uiHiddenBanner.label}</strong> is hidden in the dashboard UI for this deployment.
              </p>
              <p class="ui-hidden-banner-detail">
                You can still manage it with the REST API, CLI, or automation. Remove it from
                <code class="ui-hidden-code">RESTORMEL_DASHBOARD_UI_HIDDEN</code> to show this section again.
              </p>
              <p class="ui-hidden-banner-actions">
                <a href={DASHBOARD_BASE + "/"} class="ui-hidden-dismiss">Dismiss</a>
              </p>
            </div>
          {/if}
          <DashboardJourneyBanner {currentPath} {user} {journeySignals} />
          <slot />
        {/if}
      </main>
    </div>
  </div>
  {#if user}
    <FeedbackWidget />
  {/if}
{/if}

<style>
  .shell {
    display: flex;
    min-height: 100vh;
    max-width: var(--rm-container-max);
    margin: 0 auto;
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .sidebar {
    width: 12rem;
    background: var(--rm-surface);
    border-right: 1px solid var(--rm-border);
    padding: var(--space-4) 0;
    display: flex;
    flex-direction: column;
  }
  .nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
    min-height: 0;
  }
  .nav-link-overview {
    margin-bottom: var(--space-1);
  }
  .nav-group {
    margin-top: var(--space-1);
  }
  .nav-group-header {
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--rm-dim);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) var(--space-4);
    min-height: 44px;
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .nav-group-label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .nav-group-header:hover {
    color: var(--rm-muted);
  }
  .nav-group-links {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .nav-link {
    padding: var(--space-2) var(--space-4);
    min-height: 44px;
    display: flex;
    align-items: center;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .nav-link:hover {
    color: var(--rm-sage);
    background: var(--rm-sage-bg);
    text-decoration: none;
  }
  .nav-link-active {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .main-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .topbar {
    min-height: 3rem;
    border-bottom: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    padding: var(--space-2) var(--space-6);
  }
  .topbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }
  .topbar-nav-toggle {
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-muted);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    white-space: nowrap;
  }
  .topbar-nav-toggle:hover {
    background: var(--rm-surface);
    color: var(--rm-text);
  }
  .topbar-title {
    font-size: var(--text-base);
    color: var(--rm-text);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .topbar-product-nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
  }
  .topbar-product-pill {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, var(--rm-sage) 14%, transparent);
    color: var(--rm-text);
    font-weight: var(--font-medium);
    border: 1px solid var(--rm-border);
  }
  .topbar-product-link {
    color: var(--rm-muted);
    text-decoration: none;
    padding: var(--space-1) 0;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .topbar-product-link:hover {
    color: var(--rm-sage);
    text-decoration: none;
  }
  .sidebar-footer {
    margin-top: var(--space-2);
    padding: var(--space-3) var(--space-3) 0;
  }
  .feedback-nav-wrap {
    margin-top: auto;
    padding: var(--space-3) var(--space-3) 0;
  }
  .feedback-nav-btn {
    width: 100%;
    border: 1px dashed var(--rm-border);
    border-radius: var(--rm-radius);
    background: transparent;
    color: var(--rm-muted);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    cursor: pointer;
    text-align: left;
  }
  .feedback-nav-btn:hover {
    color: var(--rm-text);
    border-color: var(--rm-muted);
    background: var(--rm-surface);
  }
  .feedback-icon {
    width: 0.9rem;
    height: 0.9rem;
    fill: currentColor;
    flex: 0 0 auto;
  }
  .sidebar-nav-toggle {
    width: 100%;
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-muted);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-2);
    font-size: var(--text-xs);
    text-align: left;
    white-space: nowrap;
  }
  .sidebar-nav-toggle:hover {
    background: var(--rm-surface);
    color: var(--rm-text);
  }
  .main {
    flex: 1;
    padding: var(--space-6);
  }

  .shell-collapsed .sidebar {
    width: 0;
    padding: 0;
    border-right: 0;
    overflow: hidden;
  }
  .auth-error {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--rm-error-bg, rgba(201, 92, 92, 0.12));
    color: var(--rm-error, #c95c5c);
    font-size: 0.875rem;
    border-radius: var(--rm-radius);
  }
  .auth-error p {
    margin: 0 0 var(--space-2);
  }
  .auth-error p:last-child {
    margin-bottom: 0;
  }
  .auth-error-actions {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .auth-error-link {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .auth-error-link:hover {
    text-decoration: underline;
  }
  .welcome {
    max-width: var(--rm-container-narrow);
  }
  .welcome-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .welcome-intro {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    margin: 0 0 var(--space-5);
  }
  .welcome-checklist {
    margin: 0 0 var(--space-5);
    padding-left: var(--space-5);
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: 1.6;
  }
  .welcome-checklist li {
    margin-bottom: var(--space-2);
  }
  .welcome-checklist strong {
    color: var(--rm-text);
  }
  .welcome-links {
    margin: 0;
    font-size: var(--text-sm);
  }
  .welcome-links a {
    color: var(--rm-sage);
  }
  .welcome-sep {
    color: var(--rm-dim);
    margin: 0 var(--space-2);
  }
  .mobile-gate-wrap {
    max-width: var(--rm-container-narrow);
    margin: 0 auto;
    padding: var(--space-6) var(--space-4);
  }
  .mobile-gate {
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-5);
  }
  .mobile-gate-title {
    margin: 0 0 var(--space-2);
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
  }
  .mobile-gate-desc {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .mobile-gate-links {
    margin: 0;
    font-size: var(--text-sm);
  }
  .mobile-gate-links a {
    color: var(--rm-sage);
  }
  .mobile-gate-sep {
    color: var(--rm-dim);
    margin: 0 var(--space-2);
  }

  .ui-hidden-banner {
    margin: 0 0 var(--space-5);
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .ui-hidden-banner p {
    margin: 0 0 var(--space-2);
  }
  .ui-hidden-banner p:last-child {
    margin-bottom: 0;
  }
  .ui-hidden-banner-detail {
    color: var(--rm-muted);
    line-height: var(--leading-normal);
  }
  .ui-hidden-code {
    font-size: 0.85em;
  }
  .ui-hidden-banner-actions {
    margin-top: var(--space-2);
  }
  .ui-hidden-dismiss {
    color: var(--rm-sage);
    font-weight: 500;
    text-decoration: none;
  }
  .ui-hidden-dismiss:hover {
    text-decoration: underline;
  }
</style>
