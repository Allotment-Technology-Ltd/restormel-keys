<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { base } from "$app/paths";
  import AppLogo from "$lib/components/AppLogo.svelte";

  $: user = $page.data.user;
  $: isAuthRoute = $page.url.pathname === base + "/login" || $page.url.pathname === base + "/logout";
</script>

{#if isAuthRoute}
  <slot />
{:else}
  <div class="shell">
    <aside class="sidebar">
      <div class="logo">
        <AppLogo height="26" />
      </div>
      <nav class="nav" aria-label="Dashboard">
        <a href={base + "/"} class="nav-link">Overview</a>
        <a href={base + "/projects"} class="nav-link">Projects</a>
        <a href={base + "/billing"} class="nav-link">Billing</a>
        <a href={base + "/settings"} class="nav-link">Settings</a>
      </nav>
      {#if user}
        <div class="sidebar-footer">
          <a href={base + "/logout"} class="nav-link">Log out</a>
        </div>
      {/if}
    </aside>
    <div class="main-wrap">
      <header class="topbar">
        <span class="topbar-title">{$page.url.pathname === base + "/" ? "Overview" : ""}</span>
        {#if user}
          <span class="topbar-user" title={user.email ?? undefined}>{user.email ?? user.uid}</span>
        {:else}
          <a href={base + "/login"} class="btn btn-primary">Sign in with GitHub</a>
        {/if}
      </header>
      <main class="main">
        {#if !user && !isAuthRoute}
          <p class="auth-prompt">Sign in to use the dashboard.</p>
          <a href={base + "/login"} class="btn btn-primary">Sign in with GitHub</a>
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
  }
  .sidebar {
    width: 12rem;
    background: var(--rm-surface);
    border-right: 1px solid var(--rm-border);
    padding: 1rem 0;
    display: flex;
    flex-direction: column;
  }
  .logo {
    margin-bottom: 1.5rem;
  }
  .nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .nav-link {
    padding: 0.5rem 1rem;
    color: var(--rm-muted);
    font-size: 0.875rem;
  }
  .nav-link:hover {
    color: var(--rm-sage);
    background: var(--rm-sage-bg);
    text-decoration: none;
  }
  .sidebar-footer {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid var(--rm-border);
  }
  .main-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .topbar {
    height: 3rem;
    border-bottom: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem;
  }
  .topbar-title {
    font-size: 0.875rem;
    color: var(--rm-muted);
  }
  .topbar-user {
    font-size: 0.8125rem;
    color: var(--rm-dim);
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .main {
    flex: 1;
    padding: 1.5rem;
  }
  .btn {
    display: inline-block;
    padding: 0.5rem 1rem;
    border-radius: var(--rm-radius);
    font-size: 0.875rem;
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
  .auth-prompt {
    margin: 0 0 1rem;
    color: var(--rm-muted);
  }
</style>
