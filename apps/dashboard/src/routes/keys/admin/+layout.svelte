<script lang="ts">
  import { page } from "$app/stores";
  import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";

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
    <a class="admin-back" href={DASHBOARD_BASE + "/"}>← Keys dashboard</a>
  </aside>
  <div class="admin-main">
    <slot />
  </div>
</div>

<style>
  .admin-shell {
    display: flex;
    min-height: calc(100vh - var(--rm-nav-height, 3.5rem));
    max-width: var(--rm-container-max);
    margin: 0 auto;
    border-left: 1px solid var(--rm-border);
    border-right: 1px solid var(--rm-border);
  }
  .admin-sidebar {
    width: 13rem;
    flex-shrink: 0;
    padding: var(--space-5) var(--space-4);
    border-right: 1px solid var(--rm-border);
    background: var(--rm-surface);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .admin-brand {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
    font-family: var(--rm-font-display);
  }
  .admin-brand-tag {
    display: inline-block;
    margin-left: var(--space-1);
    padding: 0.1rem 0.35rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: color-mix(in oklab, var(--rm-sage) 18%, var(--rm-surface-raised));
    border: 1px solid var(--rm-border);
    color: var(--rm-muted);
  }
  .admin-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
  }
  .admin-nav-link {
    padding: var(--space-2) var(--space-2);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    text-decoration: none;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  .admin-nav-link:hover {
    background: var(--rm-sage-bg);
    color: var(--rm-sage);
    text-decoration: none;
  }
  .admin-nav-link-active {
    color: var(--rm-sage);
    font-weight: 600;
    background: color-mix(in oklab, var(--rm-sage) 10%, transparent);
  }
  .admin-back {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    text-decoration: none;
    margin-top: auto;
    padding-top: var(--space-4);
  }
  .admin-back:hover {
    color: var(--rm-sage);
    text-decoration: underline;
  }
  .admin-main {
    flex: 1;
    min-width: 0;
    padding: var(--space-6);
    background: var(--rm-bg);
  }
</style>
