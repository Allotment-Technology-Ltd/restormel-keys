<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let data: { user?: { uid: string; email?: string | null } };
</script>

<h1 class="page-title">Settings</h1>
<p class="page-desc">Account settings. (Team members in Team+ later.)</p>

{#if data.user}
  <dl class="settings-list">
    <dt>User ID</dt>
    <dd><code>{data.user.uid}</code></dd>
    {#if data.user.email}
      <dt>Email</dt>
      <dd>{data.user.email}</dd>
    {/if}
  </dl>
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
</style>
