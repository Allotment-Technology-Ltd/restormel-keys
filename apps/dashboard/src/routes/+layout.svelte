<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth-client";
  import AppLogo from "$lib/components/AppLogo.svelte";

  $: user = $page.data.user;
  $: authError = $page.data.authError ?? null;
  $: isAuthRoute = $page.url.pathname === base + "/login" || $page.url.pathname === base + "/logout";

  onMount(async () => {
    const verifier = $page.url.searchParams.get("neon_auth_session_verifier");
    if (!verifier) return;
    try {
      // Let Neon SDK redeem verifier and persist session cookie using the canonical getSession flow.
      await authClient.getSession();
    } catch {
      // Ignore; authError query params (if present) are shown by layout.
    } finally {
      window.location.replace(base + "/");
    }
  });
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
      {#if user || authError}
        <div class="sidebar-footer">
          <a href={base + "/logout"} class="nav-link" data-sveltekit-reload>Log out</a>
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
          {#if authError === "session-verifier-not-found"}
            <div class="auth-error" role="alert">
              <p>Sign-in link expired or already used.</p>
              <p class="auth-error-actions">
                <a href={base + "/logout"} class="auth-error-link" data-sveltekit-reload>Log out</a> to clear any existing session, then
                <a href={base + "/login"} class="auth-error-link">sign in again</a>.
              </p>
            </div>
          {/if}
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
  .auth-error {
    margin: 0 0 1rem;
    padding: 0.75rem 1rem;
    background: var(--rm-error-bg, rgba(201, 92, 92, 0.12));
    color: var(--rm-error, #c95c5c);
    font-size: 0.875rem;
    border-radius: var(--rm-radius);
  }
  .auth-error p {
    margin: 0 0 0.5rem;
  }
  .auth-error p:last-child {
    margin-bottom: 0;
  }
  .auth-error-actions {
    color: var(--rm-muted);
    font-size: 0.8125rem;
  }
  .auth-error-link {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .auth-error-link:hover {
    text-decoration: underline;
  }
</style>
