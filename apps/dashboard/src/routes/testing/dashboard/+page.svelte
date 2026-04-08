<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
</script>

<svelte:head>
  <title>Testing dashboard — Restormel</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="stub">
  <h1 class="title">Testing dashboard</h1>
  <p class="lead">
    When you are signed in, this URL sends you to the <strong>Restormel Testing hub</strong> inside the Keys
    dashboard (project IDs, snippets, and setup). A dedicated Testing-only console is not part of the MVP yet;
    use the CLI, GitHub Action, and docs in the meantime.
  </p>
  <ul class="actions">
    <li><a class="btn btn-primary" href="/testing/docs">Browse Testing documentation</a></li>
    <li><a class="btn btn-ghost" href="/testing">Testing overview</a></li>
    <li>
      <a class="btn btn-ghost" href={DASHBOARD_BASE + "/login"}>Sign in to open Testing hub</a>
    </li>
  </ul>
</div>

<style>
  .stub {
    max-width: 36rem;
    margin: 0 auto;
  }
  .title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-4);
    color: var(--rm-text);
  }
  .lead {
    margin: 0 0 var(--space-6);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--rm-muted);
  }
  .actions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-start;
  }
  .actions a {
    text-decoration: none;
  }
</style>
