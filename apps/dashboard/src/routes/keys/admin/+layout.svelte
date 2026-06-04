<script lang="ts">
  import { page } from "$app/stores";
  import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";
  import { CONNECT_HUB_HREF } from "$lib/nav-config";

  $: path = $page.url.pathname;

  function active(href: string): boolean {
    return path === href || (href !== ADMIN_BASE + "/" && path.startsWith(href + "/"));
  }
</script>

<svelte:head>
  <title>Admin – Restormel Keys</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="admin-shell">
  <aside class="admin-sidebar" aria-label="Admin navigation">
    <p class="admin-brand">Restormel <span class="admin-brand-tag">Admin</span></p>
    <nav class="admin-nav">
      <a
        class="admin-nav-link"
        class:admin-nav-link-active={active(ADMIN_BASE + "/founders")}
        href={ADMIN_BASE + "/founders"}
        aria-current={active(ADMIN_BASE + "/founders") ? "page" : undefined}
      >
        Founders Circle
      </a>
      <a
        class="admin-nav-link"
        class:admin-nav-link-active={active(ADMIN_BASE + "/users")}
        href={ADMIN_BASE + "/users"}
        aria-current={active(ADMIN_BASE + "/users") ? "page" : undefined}
      >
        User management
      </a>
      <a
        class="admin-nav-link"
        class:admin-nav-link-active={active(ADMIN_BASE + "/package-registry")}
        href={ADMIN_BASE + "/package-registry"}
        aria-current={active(ADMIN_BASE + "/package-registry") ? "page" : undefined}
      >
        Package registry
      </a>
    </nav>
    <a class="admin-back" href={CONNECT_HUB_HREF}>← Connect hub</a>
  </aside>
  <div class="admin-main">
    <slot />
  </div>
</div>

<style>
  .admin-shell {
    display: flex;
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: var(--rm-container-max);
    margin: 0 auto;
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
  }
  .admin-sidebar {
    width: 13rem;
    flex-shrink: 0;
    padding: var(--space-5) var(--space-4);
    border-right: var(--border);
    background: var(--color-bg-deep);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .admin-brand {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink);
  }
  .admin-brand-tag {
    display: inline-block;
    margin-left: var(--space-1);
    padding: 2px 6px;
    border-radius: 0;
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: var(--color-yellow);
    border: var(--border-thin);
    color: var(--color-ink);
  }
  .admin-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
  }
  .admin-nav-link {
    padding: var(--space-2);
    border-radius: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
    text-decoration: none;
    min-height: 44px;
    display: flex;
    align-items: center;
    border: var(--border-thin);
    border-color: transparent;
  }
  .admin-nav-link:hover {
    background: var(--color-yellow);
    color: var(--color-ink);
    text-decoration: none;
  }
  .admin-nav-link-active {
    color: var(--color-ink);
    font-weight: 700;
    background: var(--color-yellow);
    border-color: var(--color-ink);
  }
  .admin-back {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    color: var(--color-ink-faint);
    text-decoration: none;
    margin-top: auto;
    padding-top: var(--space-4);
  }
  .admin-back:hover {
    color: var(--color-ink);
    background: var(--color-yellow);
    text-decoration: none;
  }
  .admin-main {
    flex: 1;
    min-width: 0;
    padding: var(--space-6);
    background: var(--color-bg);
  }
</style>
