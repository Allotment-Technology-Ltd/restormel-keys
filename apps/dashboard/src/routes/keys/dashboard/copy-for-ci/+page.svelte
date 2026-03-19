<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import EmptyState from "$lib/components/EmptyState.svelte";

  export let data: {
    projects: { id: string; name: string; createdAt?: number }[];
    error: string | null;
  };
</script>

<svelte:head>
  <title>Copy for CI — Restormel Keys</title>
</svelte:head>

<h1 class="page-title">Copy for CI (GitHub Secrets)</h1>
<p class="page-desc">
  Copy project ID, environment ID, and get a Gateway key to paste into your repo’s <strong>Settings → Secrets and variables → Actions</strong>. Use a <strong>staging</strong> project for CI — never production.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{/if}

{#if data.projects.length === 0}
  <EmptyState
    title="No projects yet"
    description="Create a project first. Then open it to copy project ID, environment ID, and create a Gateway key for CI."
  >
    <a href={DASHBOARD_BASE + "/projects"} class="btn btn-primary">Create a project</a>
  </EmptyState>
{:else}
  <p class="choose-desc">Choose your staging project to open its <strong>Copy for CI</strong> section (project ID, environment ID, Gateway key instructions):</p>
  <ul class="project-list">
    {#each data.projects as p}
      <li>
        <a href={DASHBOARD_BASE + "/projects/" + p.id + "#ci-secrets"} class="project-link">{p.name}</a>
      </li>
    {/each}
  </ul>
  <p class="back-link"><a href={DASHBOARD_BASE + "/projects"}>← All projects</a></p>
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
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .choose-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }
  .project-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .project-list li {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .project-link {
    font-size: var(--text-base);
    color: var(--rm-primary, var(--rm-sage));
    text-decoration: none;
  }
  .project-link:hover {
    text-decoration: underline;
  }
  .back-link {
    margin-top: var(--space-4);
    font-size: var(--text-sm);
  }
  .back-link a {
    color: var(--rm-muted);
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
</style>
