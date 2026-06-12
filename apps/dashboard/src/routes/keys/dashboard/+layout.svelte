<script lang="ts">
  import "../../../app.css";
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    NAV_GROUPS,
    CLAIMS_HREF,
    WORKSPACE_HOME_HREF,
    isWorkNavActive,
    navGroupContainsPath,
    topbarTitle,
    defaultNavGroupsOpen,
    hydrateNavGroupsOpen,
    type NavGroupId,
    type NavItem,
    type NavGroup,
  } from "$lib/nav-config";
  import { connectReviewCount } from "$lib/stores/connect-review-count";
  import { contextualHelpForPath, SUITE_MAP_LINK } from "$lib/dashboard-contextual-help";
  import { onMount } from "svelte";
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import ProjectContextSwitcher from "$lib/components/dashboard/ProjectContextSwitcher.svelte";
  import FeedbackWidget from "$lib/components/FeedbackWidget.svelte";
  import UserMenu from "$lib/components/UserMenu.svelte";
  import DashboardJourneyBanner from "$lib/components/dashboard/DashboardJourneyBanner.svelte";
  import ConnectWizardReturnBanner from "$lib/components/connect/pipeline/ConnectWizardReturnBanner.svelte";
  import MonitorComingSoonNav from "$lib/components/dashboard/MonitorComingSoonNav.svelte";
  import { openFeedbackWidget } from "$lib/stores/feedback-widget";
  import { trackDashboardFeatureInterest } from "$lib/posthog";
  import { MONITOR_COMING_SOON_ITEMS, type MonitorInterestItem } from "$lib/dashboard-monitor-interest";
  import {
    isPipelineWizardPath,
    isRouteBuilderPath,
    parseReturnTo,
  } from "$lib/connect/pipeline-config";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import LiveRunChip from "$lib/components/dashboard/LiveRunChip.svelte";
  import { isMobileAllowedPath } from "$lib/dashboard-mobile-tier";
  import AuthDegradedNotice from "$lib/components/connect/AuthDegradedNotice.svelte";

  let palette: CommandPalette | undefined;
  let paletteOpen = false;

  function openPalette() {
    paletteOpen = true;
    palette?.openPalette();
  }

  $: user = $page.data.user;
  $: authError = $page.data.authError ?? null;
  // W4.6a: verification couldn't complete for a cookie-bearing request. Render an
  // honest degraded/retry state, NEVER the signed-out welcome CTA.
  $: authDegraded = Boolean($page.data.authDegraded) && !user;
  $: isAuthRoute = $page.url.pathname === DASHBOARD_BASE + "/login" || $page.url.pathname === DASHBOARD_BASE + "/logout";
  $: currentPath = $page.url.pathname;
  // R6 mobile read-only tier: the gate opens for /home, /runs/[id], /claims.
  // On the opened surfaces the shell renders read-only (actions hidden via the
  // data-mobile-readonly flag below); everywhere else the phone gate stays up.
  $: mobileAllowed = isMobileAllowedPath(currentPath);
  $: title = topbarTitle(currentPath);
  $: contextualHelp = contextualHelpForPath(currentPath);
  $: projectContextsSource = $page.data.projectContexts ?? [];
  $: workNavForUi = ($page.data.workNavForUi ?? []) as NavItem[];
  $: testingNavForUi = ($page.data.testingNavForUi ?? null) as NavItem | null;
  $: moduleFlags = $page.data.moduleFlags ?? null;
  $: navGroupsForLayout = ($page.data.navGroupsForUi ?? NAV_GROUPS) as NavGroup[];
  $: uiHiddenBanner = $page.data.dashboardUiHiddenBanner ?? null;
  $: projectsNavHidden = ($page.data.dashboardUiHidden ?? []).includes("projects");
  $: journeySignals = $page.data.journeySignals ?? null;
  $: monitorInterestFromRedirect = ($page.data.monitorInterestFromRedirect ?? null) as MonitorInterestItem | null;
  $: monitorComingSoon = moduleFlags ? !moduleFlags.monitor : true;
  $: returnContext = parseReturnTo($page.url.searchParams);
  $: showWizardReturn =
    returnContext?.kind === "pipeline-setup" &&
    !isPipelineWizardPath($page.url.pathname) &&
    !isRouteBuilderPath($page.url.pathname);

  const STORAGE_KEY = "rk_dashboard_sidebar_collapsed";
  const NAV_GROUPS_STORAGE_KEY = "restormel_nav_groups";
  let collapsed = false;
  let isPhone = false;
  let navGroupsOpen: Record<NavGroupId, boolean> = defaultNavGroupsOpen();

  onMount(() => {
    collapsed = localStorage.getItem(STORAGE_KEY) === "true";
    try {
      const raw = localStorage.getItem(NAV_GROUPS_STORAGE_KEY);
      if (raw) {
        navGroupsOpen = hydrateNavGroupsOpen(JSON.parse(raw) as Record<string, unknown>);
      }
    } catch {
      navGroupsOpen = defaultNavGroupsOpen();
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

  let loggedMonitorInterestRedirect: MonitorInterestItem | null = null;
  let showMonitorInterestBanner = false;

  $: if (monitorInterestFromRedirect) {
    showMonitorInterestBanner = true;
  }

  function toggleNavGroup(groupId: NavGroupId) {
    const willOpen = !navGroupsOpen[groupId];
    navGroupsOpen = { ...navGroupsOpen, [groupId]: willOpen };
    localStorage.setItem(NAV_GROUPS_STORAGE_KEY, JSON.stringify(navGroupsOpen));
    if (willOpen && groupId === "observe" && monitorComingSoon) {
      trackDashboardFeatureInterest({ feature: "monitor", action: "section_expand", item: null });
    }
  }

  $: if (
    monitorInterestFromRedirect &&
    user &&
    monitorInterestFromRedirect !== loggedMonitorInterestRedirect
  ) {
    loggedMonitorInterestRedirect = monitorInterestFromRedirect;
    trackDashboardFeatureInterest({
      feature: "monitor",
      action: "direct_navigation",
      item: monitorInterestFromRedirect,
    });
  }

  function dismissMonitorInterestBanner() {
    showMonitorInterestBanner = false;
    const url = new URL($page.url);
    url.searchParams.delete("monitor-interest");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  function onMonitorInterestFeedback() {
    trackDashboardFeatureInterest({
      feature: "monitor",
      action: "notify_feedback",
      item: monitorInterestFromRedirect,
    });
    openFeedbackWidget();
  }

  function monitorInterestLabel(item: MonitorInterestItem): string {
    return MONITOR_COMING_SOON_ITEMS.find((e) => e.id === item)?.label ?? item;
  }

  function isActivePath(href: string): boolean {
    return currentPath === href || currentPath.startsWith(href + "/");
  }

  /** Reveal the group that contains the current page without collapsing others. */
  $: {
    const next = { ...navGroupsOpen };
    let changed = false;
    for (const group of navGroupsForLayout) {
      if (navGroupContainsPath(group, currentPath) && !next[group.id]) {
        next[group.id] = true;
        changed = true;
      }
    }
    if (changed) navGroupsOpen = next;
  }
</script>

<svelte:head>
  <title>{title ? `${title} – Restormel Dashboard` : "Restormel Dashboard"}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if isPhone && !mobileAllowed && !isAuthRoute}
  <div class="mobile-gate-wrap">
    <section class="mobile-gate" aria-labelledby="mobile-gate-heading">
      <h1 id="mobile-gate-heading" class="mobile-gate-title">This screen needs a bigger window</h1>
      <p class="mobile-gate-desc">
        You can read your <a href={WORKSPACE_HOME_HREF}>Home</a>, an individual
        run, and your <a href={CLAIMS_HREF}>Claims</a> on a phone. Setup, routing,
        and the consoles that change things need a desktop or tablet — they aren't usable at this width, so we
        don't pretend they are.
      </p>
      <p class="mobile-gate-links">
        <a href={WORKSPACE_HOME_HREF}>Open Home</a>
        <span class="mobile-gate-sep">·</span>
        <a href="/keys/docs">Docs</a>
        <span class="mobile-gate-sep">·</span>
        <a href={developerPortalUrl()} target="_blank" rel="noopener noreferrer">API portal</a>
      </p>
    </section>
  </div>
{:else if isAuthRoute}
  <slot />
{:else}
  <div
    class="shell"
    class:shell-collapsed={collapsed}
    class:shell-mobile-readonly={isPhone && mobileAllowed}
    data-mobile-readonly={isPhone && mobileAllowed ? "true" : undefined}
    data-sveltekit-preload-data="tap"
  >
    <aside class="sidebar" aria-label="Dashboard navigation">
      <nav class="nav" aria-label="Dashboard" data-sveltekit-preload-data="tap">
        {#if !projectsNavHidden}
          <div class="nav-section nav-section-scope">
            <p class="nav-section-label" id="nav-scope-label">Project</p>
            {#await Promise.resolve(projectContextsSource)}
              <ProjectContextSwitcher projects={[]} {moduleFlags} labelledBy="nav-scope-label" />
            {:then projectContexts}
              <ProjectContextSwitcher projects={projectContexts ?? []} {moduleFlags} labelledBy="nav-scope-label" />
            {:catch}
              <ProjectContextSwitcher projects={[]} {moduleFlags} labelledBy="nav-scope-label" />
            {/await}
          </div>
        {/if}

        <div class="nav-section nav-section-work">
          <p class="nav-section-label" id="nav-work-label">Work</p>
          <div class="nav-section-links" role="group" aria-labelledby="nav-work-label">
            {#each workNavForUi as item}
              {@const claimsBadge =
                item.href === CLAIMS_HREF && $connectReviewCount && $connectReviewCount > 0
                  ? $connectReviewCount
                  : null}
              <a
                href={item.href}
                class="nav-link nav-link-work"
                class:nav-link-active={isWorkNavActive(currentPath, item.href)}
                aria-current={isWorkNavActive(currentPath, item.href) ? "page" : undefined}
                aria-label={claimsBadge
                  ? `${item.label} — ${claimsBadge} ${claimsBadge === 1 ? "claim needs" : "claims need"} review`
                  : undefined}
              >
                {item.label}
                {#if claimsBadge}
                  <span class="nav-badge" aria-hidden="true">{claimsBadge}</span>
                {/if}
              </a>
            {/each}
          </div>
        </div>

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
                <span>{group.label}</span>
              </span>
              <span aria-hidden="true">{navGroupsOpen[group.id] ? "▾" : "▸"}</span>
            </button>
            {#if navGroupsOpen[group.id]}
              <div class="nav-group-links" id={`nav-group-links-${group.id}`} role="group" aria-label={group.label}>
                {#if group.comingSoon}
                  <MonitorComingSoonNav />
                {:else}
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
                {/if}
              </div>
            {/if}
          </section>
        {/each}

        {#if testingNavForUi}
          <div class="nav-section nav-section-testing">
            <a
              href={testingNavForUi.href}
              class="nav-link nav-link-work"
              class:nav-link-active={isWorkNavActive(currentPath, testingNavForUi.href)}
              aria-current={isWorkNavActive(currentPath, testingNavForUi.href) ? "page" : undefined}
            >
              {testingNavForUi.label}
            </a>
          </div>
        {/if}
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
        <nav class="topbar-help" aria-label="Help">
          <a href={contextualHelp.href} class="topbar-help-link">{contextualHelp.label}</a>
          <span class="topbar-help-sep" aria-hidden="true">·</span>
          <a href={SUITE_MAP_LINK.href} class="topbar-help-link">{SUITE_MAP_LINK.label}</a>
        </nav>
        {#if user}
          <!-- R6: live-run chip — appears on any page while an ingest run is active,
               fed by ONE workspace-scoped 30s poll (W3.1 SSE absent). -->
          <div class="topbar-live-run">
            <LiveRunChip />
          </div>
        {/if}
        {#if user}
          <button
            type="button"
            class="topbar-palette-btn"
            aria-label="Open command palette (⌘K)"
            title="Search and navigate (⌘K / Ctrl+K)"
            on:click={openPalette}
          >
            <span class="topbar-palette-icon" aria-hidden="true">⌕</span>
            <span class="topbar-palette-label">Search</span>
            <kbd class="topbar-palette-kbd" aria-hidden="true">⌘K</kbd>
          </button>
        {/if}
        {#if user}
          <div class="topbar-account">
            <UserMenu {user} align="right" />
          </div>
        {/if}
      </header>
      <main class="main" data-sveltekit-preload-data="tap">
        {#if authDegraded && !isAuthRoute}
          <div class="auth-degraded-shell">
            <AuthDegradedNotice />
          </div>
        {:else if !user && !isAuthRoute}
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
              <h1 id="welcome-heading" class="welcome-title">Restormel Dashboard</h1>
              <p class="welcome-intro">
                One workspace for routing live traffic, assuring quality in CI, and building knowledge graphs — sign in to see your next step.
              </p>
              <ol class="welcome-checklist" aria-label="Get started">
                <li><strong>Sign in</strong> with GitHub.</li>
                <li><strong>Home</strong> shows workspace health, setup progress, and your next step.</li>
                <li><strong>Sources → Runs → Claims</strong> is where you ingest documents, build a graph, and review claims; <strong>Prove</strong> and <strong>Agents</strong> serve it to outsiders and agents.</li>
                <li><strong>Foundation</strong> in the sidebar wires Connections, routes, and guard rails for every stage.</li>
                <li><strong>Testing &amp; Graph</strong> open when you need CI assurance or embedded graph UIs.</li>
                <li><strong>Docs</strong> — <a href="/docs/how-it-fits-together">how the suite fits together</a> when you want the map.</li>
              </ol>
              <p class="welcome-links">
                <a href="/keys/docs/">Docs</a>
                <span class="welcome-sep">·</span>
                <a href={developerPortalUrl()} target="_blank" rel="noopener noreferrer">API portal</a>
                <span class="welcome-sep">·</span>
                <a href="/founders">Early access</a>
              </p>
            </div>
          {/if}
        {:else}
          {#if showMonitorInterestBanner && monitorInterestFromRedirect}
            <div class="monitor-interest-banner" role="status">
              <p>
                <strong>{monitorInterestLabel(monitorInterestFromRedirect)}</strong> in Monitor is not available yet — we are
                prioritising the roadmap from interest like yours.
              </p>
              <p class="monitor-interest-banner-actions">
                <button type="button" class="monitor-interest-feedback" on:click={onMonitorInterestFeedback}>
                  Tell us what you need
                </button>
                <button type="button" class="monitor-interest-dismiss" on:click={dismissMonitorInterestBanner}>
                  Dismiss
                </button>
              </p>
            </div>
          {/if}
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
          <DashboardJourneyBanner {currentPath} {user} {journeySignals} {moduleFlags} />
          {#if showWizardReturn && returnContext?.kind === "pipeline-setup"}
            <ConnectWizardReturnBanner context={returnContext} />
          {/if}
          <slot />
        {/if}
      </main>
    </div>
  </div>
  {#if user}
    <FeedbackWidget />
  {/if}
  <CommandPalette bind:this={palette} bind:open={paletteOpen} />
{/if}

<style>
  .shell {
    display: flex;
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: var(--rm-container-max);
    margin: 0 auto;
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    overflow: hidden;
  }
  .sidebar {
    width: 13rem;
    background: var(--brut-white);
    border-right: var(--brut-border-width) solid var(--brut-ink);
    padding: var(--space-4) 0;
    display: flex;
    flex-direction: column;
  }
  .nav {
    display: flex;
    flex-direction: column;
    gap: 0;
    flex: 1;
    min-height: 0;
  }
  .nav-section {
    padding-bottom: var(--space-3);
    margin-bottom: var(--space-2);
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
  }
  .nav-section-work {
    padding-bottom: var(--space-2);
  }
  .nav-section-label {
    margin: 0;
    padding: 0 var(--space-4) var(--space-2);
    font-size: 0.625rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }
  .nav-section-links {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .nav-link-work {
    font-weight: 700;
  }
  .nav-group {
    margin-top: var(--space-1);
  }
  .nav-group-header {
    width: 100%;
    border: 0;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-canvas);
    color: var(--brut-ink);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) var(--space-4);
    min-height: 44px;
    font-size: var(--text-xs);
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .nav-group-label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .nav-group-header:hover {
    background: var(--brut-neon);
  }
  .nav-group-links {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .nav-link {
    padding: var(--space-2) var(--space-4);
    min-height: 44px;
    display: flex;
    align-items: center;
    color: var(--brut-ink);
    font-size: var(--text-sm);
    font-weight: 600;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
  }
  .nav-link:hover {
    color: var(--brut-ink);
    background: var(--brut-neon);
    text-decoration: none;
  }
  .nav-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: var(--space-2);
    min-width: 1.25em;
    height: 1.25em;
    padding: 0 0.3em;
    border-radius: 999px;
    background: var(--brut-ink);
    color: var(--brut-white);
    font-size: 0.7em;
    font-weight: 700;
    line-height: 1;
  }
  .nav-link-active .nav-badge {
    background: var(--color-ink);
    color: var(--color-yellow);
  }
  .nav-section-testing {
    margin-top: var(--space-2);
    border-bottom: 0;
    padding-bottom: 0;
  }
  .nav-link-active {
    color: var(--color-ink);
    background: var(--color-yellow);
    font-weight: 900;
  }
  .main-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .topbar {
    min-height: 3rem;
    border-bottom: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
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
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-neon);
    color: var(--brut-ink);
    border-radius: 0;
    font-weight: 800;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .topbar-nav-toggle:hover {
    background: var(--brut-neon);
    color: var(--brut-ink);
  }
  .topbar-title {
    font-size: var(--text-base);
    color: var(--brut-ink);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .topbar-help {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
  }
  .topbar-help-link {
    color: var(--brut-ink);
    font-weight: 700;
    text-decoration: none;
    padding: var(--space-1) var(--space-2);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    border: var(--brut-border-micro) solid transparent;
  }
  .topbar-help-link:hover {
    color: var(--brut-ink);
    background: var(--brut-neon);
    border-color: var(--brut-ink);
    text-decoration: none;
  }
  .topbar-help-sep {
    color: var(--rm-muted);
    user-select: none;
  }
  .topbar-palette-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--rm-muted);
    border-radius: 0;
    padding: var(--space-1) var(--space-3);
    min-height: 36px;
    cursor: pointer;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 600;
    flex-shrink: 0;
  }
  .topbar-palette-btn:hover {
    background: var(--brut-neon);
    color: var(--brut-ink);
    border-color: var(--brut-ink);
  }
  .topbar-palette-btn:focus-visible {
    outline: 2px solid var(--brut-ink);
    outline-offset: 2px;
  }
  .topbar-palette-icon {
    font-size: 0.9rem;
    line-height: 1;
  }
  .topbar-palette-label {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .topbar-palette-kbd {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--rm-muted);
    border: 1px solid currentColor;
    padding: 0.05rem 0.25rem;
    border-radius: 0;
    opacity: 0.7;
  }
  .topbar-live-run {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .topbar-account {
    display: flex;
    align-items: center;
    flex-shrink: 0;
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
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-radius: 0;
    background: var(--brut-white);
    color: var(--brut-ink);
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    cursor: pointer;
    text-align: left;
  }
  .feedback-nav-btn:hover {
    color: var(--brut-ink);
    background: var(--brut-neon);
  }
  .feedback-icon {
    width: 0.9rem;
    height: 0.9rem;
    fill: currentColor;
    flex: 0 0 auto;
  }
  .sidebar-nav-toggle {
    width: 100%;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
    font-weight: 800;
    border-radius: 0;
    padding: var(--space-2) var(--space-2);
    font-size: var(--text-xs);
    text-transform: uppercase;
    text-align: left;
    white-space: nowrap;
  }
  .sidebar-nav-toggle:hover {
    background: var(--brut-neon);
    color: var(--brut-ink);
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
    background: var(--brut-coral);
    color: var(--brut-ink);
    font-weight: 600;
    font-size: 0.875rem;
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    box-shadow: var(--brut-shadow);
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
  .auth-degraded-shell {
    max-width: var(--rm-container-narrow);
    margin: var(--space-6) 0;
  }
  .welcome-title {
    font-family: var(--brut-font);
    font-size: var(--text-3xl);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    color: var(--brut-ink);
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
  /* ── R6 mobile read-only tier ─────────────────────────────────────────────
     On a phone, the opened surfaces (Home, run console, Claims) render the shell
     without the sidebar, full-bleed, with comfortable padding and ≥44px touch
     targets. Action chrome that mutates state is hidden — read-only, not teasing. */
  .shell-mobile-readonly {
    border: 0;
    max-width: 100%;
  }
  .shell-mobile-readonly .sidebar {
    display: none;
  }
  .shell-mobile-readonly .topbar {
    padding: var(--space-2) var(--space-4);
  }
  .shell-mobile-readonly .topbar-help,
  .shell-mobile-readonly .topbar-nav-toggle,
  .shell-mobile-readonly .topbar-palette-btn {
    display: none;
  }
  .shell-mobile-readonly .main {
    padding: var(--space-4);
  }
  /* Hide mutating actions on the opened read-only surfaces — read-only, not
     teasing. Pages can opt their own controls out with [data-mobile-hide]; we
     also hide the run console's known action regions (cancel / restart) so the
     console reads as a status view on a phone. The live-run chip and read links
     stay.

     The /claims surface mounts ConnectGraphExplorer (+ ConnectGraphReadinessWizard),
     whose mutation affordances POST/PATCH/DELETE to the Connect pipeline. We hide
     every mutation *region* by a small set of stable container class selectors so
     the contract is robust to internal explorer changes (the explorer logic is
     untouched — we only suppress the action chrome). Read-only viewing
     (pan/zoom/select/inspect, glossary, provenance, recheck results, guidance)
     stays live. Covered explorer/wizard mutation regions:
       .review-actions        — verdict approve/reject/supported (performReview)
       .dossier-actions        — Accept · supported / Exclude (performEvidenceAccept/Exclude)
       .dossier-recheck        — Re-check now (runEvidenceRecheck)
       .remove-section         — Remove from graph (removeFromGraph, DELETE)
       .cohort-complete-actions — Start next run (createReadinessRun)
       .revalidate-actions      — Auto-remediate (startAutoRemediation)
       .wizard-actions          — scan / saveMapping / syncPack / import /
                                  linkSources / embed / validate (readiness wizard)

     Also covered (added in the fix-forward audit):
       .lib-new                 — readiness library "New run" create (createReadinessRun, POST)
       .lib-run-archive         — readiness library archive (archiveReadinessRun, PATCH)
       .run-error-banner-actions — failed-run banner restart (restartJob, POST /restart)
       .switcher-control        — /home active-graph select on:change (POST /<id>/activate)

     Also covered (/claims/memory revoke — iteration 3):
       .item-actions            — memory page per-observation Revoke button (POST /revoke)
       .memory-revoke-error     — memory page per-observation revoke-error banner + "Try again"
                                  (re-fires POST /revoke; the outer page-load error banner's
                                  "Try again" calls invalidateAll and is intentionally NOT hidden)

     The verdict keyboard shortcuts (a/w/u) bypass CSS hiding, so they are guarded
     separately in ConnectGraphExplorer's handleReviewKeydown, which early-returns
     when a [data-mobile-readonly="true"] shell is present in the DOM.

     W4.2 Stamping Desk (.desk-enter / .desk-mount): the entry button opens a
     keyboard triage overlay whose S/W/X stamps PATCH validation. Hidden here so
     it can't be opened on the read-only tier; the explorer ALSO re-checks the
     mobile flag at call time (deskMutationBlocked) before entering/stamping. */
  .shell-mobile-readonly :global([data-mobile-hide]),
  .shell-mobile-readonly :global(.run-actions),
  .shell-mobile-readonly :global(.run-cancel-wrap),
  .shell-mobile-readonly :global(.run-error-banner-actions),
  .shell-mobile-readonly :global(.review-actions),
  .shell-mobile-readonly :global(.dossier-actions),
  .shell-mobile-readonly :global(.dossier-recheck),
  .shell-mobile-readonly :global(.remove-section),
  .shell-mobile-readonly :global(.cohort-complete-actions),
  .shell-mobile-readonly :global(.revalidate-actions),
  .shell-mobile-readonly :global(.wizard-actions),
  .shell-mobile-readonly :global(.lib-new),
  .shell-mobile-readonly :global(.lib-run-archive),
  .shell-mobile-readonly :global(.switcher-control),
  .shell-mobile-readonly :global(.item-actions),
  .shell-mobile-readonly :global(.memory-revoke-error),
  .shell-mobile-readonly :global(.desk-enter),
  .shell-mobile-readonly :global(.desk-mount) {
    display: none !important;
  }
  .shell-mobile-readonly :global(a),
  .shell-mobile-readonly :global(button) {
    min-height: 44px;
  }
  .mobile-gate-wrap {
    max-width: var(--rm-container-narrow);
    margin: 0 auto;
    padding: var(--space-6) var(--space-4);
  }
  .mobile-gate {
    background: var(--brut-white);
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    box-shadow: var(--brut-shadow);
    padding: var(--space-5);
  }
  .mobile-gate-title {
    margin: 0 0 var(--space-2);
    font-family: var(--brut-font);
    font-size: var(--text-2xl);
    font-weight: 900;
    text-transform: uppercase;
    color: var(--brut-ink);
  }
  .mobile-gate-desc {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .mobile-gate-desc a {
    color: var(--rm-sage);
    font-weight: 700;
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
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    box-shadow: var(--brut-shadow);
    background: var(--brut-neon);
    font-size: var(--text-sm);
    color: var(--brut-ink);
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
  .monitor-interest-banner {
    margin: 0 0 var(--space-5);
    padding: var(--space-4);
    border: var(--brut-border-width) solid var(--brut-ink);
    border-radius: 0;
    box-shadow: var(--brut-shadow);
    background: var(--brut-canvas);
    font-size: var(--text-sm);
    color: var(--brut-ink);
  }
  .monitor-interest-banner p {
    margin: 0 0 var(--space-2);
  }
  .monitor-interest-banner-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
  }
  .monitor-interest-feedback,
  .monitor-interest-dismiss {
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
    font-size: var(--text-xs);
    font-weight: 700;
    padding: var(--space-2) var(--space-3);
    min-height: 44px;
    cursor: pointer;
  }
  .monitor-interest-feedback:hover {
    background: var(--brut-neon);
  }
  .monitor-interest-dismiss:hover {
    background: var(--color-bg-deep);
  }
</style>
