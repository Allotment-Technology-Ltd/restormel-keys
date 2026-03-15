<script lang="ts">
  import { base } from "$app/paths";

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
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 0.5rem;
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: 0.875rem;
    margin: 0 0 1rem;
  }
  .settings-list {
    margin: 0;
  }
  .settings-list dt {
    font-size: 0.75rem;
    color: var(--rm-dim);
    margin-top: 0.75rem;
  }
  .settings-list dd {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
  }
  .settings-list dd code {
    font-size: 0.8125rem;
    color: var(--rm-muted);
  }
</style>
