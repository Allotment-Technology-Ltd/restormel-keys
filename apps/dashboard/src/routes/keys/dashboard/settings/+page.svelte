<script lang="ts">
  import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";

  export let data: { user?: { uid: string; email?: string | null; isServiceAdmin?: boolean } };
  $: isOp = data.user?.isServiceAdmin === true;
</script>

<h1 class="page-title">Profile &amp; settings</h1>
<p class="page-desc">Account, subscription, and sign-out.</p>

{#if data.user}
  {#if isOp}
    <section class="settings-section" aria-labelledby="admin-heading">
      <h2 id="admin-heading" class="section-title">Service owner</h2>
      <p class="section-desc">
        Open the <strong>admin console</strong> (avatar menu → Admin) for user management and package insights. Prefer
        assigning an <strong>admin</strong> (or <code>service_admin</code> / <code>operator</code>) role in
        <strong>Neon Auth</strong> when your project exposes <code>user.role</code> on the session — that is the easiest
        way to grant operator access. You can also use the <code>service_admins</code> table or deployment env vars; see
        the service-admin runbook.
      </p>
      <p class="section-links">
        <a class="link" href={ADMIN_BASE + "/users"}>User management</a>
        <span class="sep" aria-hidden="true">·</span>
        <a class="link" href={ADMIN_BASE + "/package-registry"}>Package registry insights</a>
      </p>
    </section>
  {/if}

  <section class="settings-section" aria-labelledby="account-heading">
    <h2 id="account-heading" class="section-title">Account</h2>
    <dl class="settings-list">
      <dt>User ID</dt>
      <dd><code>{data.user.uid}</code></dd>
      {#if data.user.email}
        <dt>Email</dt>
        <dd>{data.user.email}</dd>
      {/if}
    </dl>
  </section>

  <section class="settings-section" aria-labelledby="subscription-heading">
    <h2 id="subscription-heading" class="section-title">Subscription</h2>
    <p class="section-desc">Manage your subscription and view invoices.</p>
    <p class="section-links">
      <a class="link" href={DASHBOARD_BASE + "/billing"}>Manage subscription</a>
      <span class="sep" aria-hidden="true">·</span>
      <a class="link" href="/keys/pricing">View pricing</a>
    </p>
  </section>

  <section class="settings-section" aria-labelledby="signout-heading">
    <h2 id="signout-heading" class="section-title">Sign out</h2>
    <p class="section-desc">Sign out of the dashboard on this device.</p>
    <a class="btn btn-secondary" href={DASHBOARD_BASE + "/logout"} data-sveltekit-reload>Sign out</a>
  </section>
{/if}

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .settings-section {
    margin: 0 0 var(--space-6);
    padding: var(--space-4);
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
  }
  .section-title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
  }
  .section-desc {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .settings-list {
    margin: 0;
  }
  .settings-list dt {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin-top: var(--space-3);
  }
  .settings-list dd {
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
  }
  .settings-list dd code {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .section-links {
    margin: 0;
    font-size: var(--text-sm);
  }
  .link {
    color: var(--rm-sage);
    font-weight: 500;
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }
  .sep {
    color: var(--rm-dim);
    margin: 0 var(--space-2);
  }
  .btn {
    display: inline-block;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
    text-decoration: none;
  }
  .btn-secondary {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .btn-secondary:hover {
    border-color: var(--rm-sage);
    color: var(--rm-sage);
    text-decoration: none;
  }
</style>
