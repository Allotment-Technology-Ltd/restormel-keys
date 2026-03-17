<script lang="ts">
  import "../../../app.css";
  import { page } from "$app/stores";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { NAV_ITEMS, topbarTitle } from "$lib/nav-config";
  import { onMount } from "svelte";

  $: user = $page.data.user;
  $: authError = $page.data.authError ?? null;
  $: isAuthRoute = $page.url.pathname === DASHBOARD_BASE + "/login" || $page.url.pathname === DASHBOARD_BASE + "/logout";
  $: currentPath = $page.url.pathname;
  $: title = topbarTitle(currentPath);

  const STORAGE_KEY = "rk_dashboard_sidebar_collapsed";
  let collapsed = false;

  onMount(() => {
    collapsed = localStorage.getItem(STORAGE_KEY) === "true";
  });

  function toggleSidebar() {
    collapsed = !collapsed;
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if isAuthRoute}
  <slot />
{:else}
  <div class="shell" class:shell-collapsed={collapsed}>
    <aside class="sidebar" aria-label="Dashboard navigation">
      <nav class="nav" aria-label="Dashboard">
        {#each NAV_ITEMS as item}
          {#if item.external}
            <a href={item.href} class="nav-link" target="_blank" rel="noopener noreferrer">{item.label}</a>
          {:else}
            <a href={item.href} class="nav-link" class:nav-link-active={currentPath === item.href || (item.href !== DASHBOARD_BASE + "/" && currentPath.startsWith(item.href + "/"))}>{item.label}</a>
          {/if}
        {/each}
      </nav>
      {#if user || authError}
        <div class="sidebar-footer">
          <a href={DASHBOARD_BASE + "/logout"} class="nav-link" data-sveltekit-reload>Log out</a>
        </div>
      {/if}
    </aside>
    <div class="main-wrap">
      <header class="topbar">
        <div class="topbar-left">
          <button
            type="button"
            class="topbar-nav-toggle"
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expand dashboard navigation" : "Collapse dashboard navigation"}
            on:click={toggleSidebar}
          >
            {collapsed ? "Expand nav" : "Collapse nav"}
          </button>
          <span class="topbar-title">{title}</span>
        </div>
        {#if user}
          <span class="topbar-user" title={user.email ?? undefined}>{user.email ?? user.uid}</span>
        {:else}
          <a href={DASHBOARD_BASE + "/login"} class="btn btn-primary">Sign in with GitHub</a>
        {/if}
      </header>
      <main class="main">
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
              <p class="welcome-intro">Control your AI access from one place: create a workspace and project, create a Gateway Key to call the API, connect providers, define routes, and track usage.</p>
              <ol class="welcome-checklist" aria-label="Get started">
                <li><strong>Sign in</strong> with GitHub (button above).</li>
                <li><strong>Workspace</strong> — created automatically. Then <strong>create a project</strong> (one per app).</li>
                <li><strong>Key model:</strong> A <strong>Gateway Key</strong> lets your app call Restormel. A <strong>provider credential</strong> (e.g. OpenAI key) lets Restormel route requests; you can use one or both.</li>
                <li><strong>Billing</strong> — bring your own keys or Restormel-managed, per route.</li>
                <li><strong>Create a Gateway Key</strong> (Access), <strong>connect a provider</strong> (Integrations), then <strong>create a route</strong> (Routes).</li>
                <li><strong>First request</strong> → then <strong>Analytics</strong> and Logs.</li>
              </ol>
              <p class="welcome-links">
                <a href="/keys/docs/">Docs</a>
                <span class="welcome-sep">·</span>
                <a href="/keys/pricing">Pricing</a>
              </p>
            </div>
          {/if}
        {:else}
          <slot />
        {/if}
      </main>
    </div>
  </div>
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
  }
  .nav-link {
    padding: var(--space-2) var(--space-4);
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
  .sidebar-footer {
    margin-top: auto;
    padding-top: var(--space-4);
    border-top: 1px solid var(--rm-border);
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
    padding: 0 var(--space-6);
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
  .topbar-user {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
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
  .btn {
    display: inline-block;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-primary:hover {
    filter: brightness(1.1);
    text-decoration: none;
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
</style>
