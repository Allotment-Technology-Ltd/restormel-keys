<script lang="ts">
  import { base } from "$app/paths";
  import EmptyState from "$lib/components/EmptyState.svelte";

  export let data: { projects: { id: string; name: string }[]; projectsError?: string | null };
</script>

<h1 class="page-title">Overview</h1>
<p class="page-desc">Your projects and quick stats.</p>

{#if data.projectsError}
  <p class="error-msg" role="alert">{data.projectsError}. Check Vercel logs for database errors.</p>
{/if}
{#if data.projects.length === 0}
  <EmptyState
    title="No projects yet"
    description="Create a project to get API keys and use the Cloud API."
  >
    <a href={base + "/projects"} class="btn btn-primary">Create a project</a>
  </EmptyState>
{:else}
  <ul class="project-list">
    {#each data.projects as p}
      <li>
        <a href={base + "/projects/" + p.id}>{p.name}</a>
      </li>
    {/each}
  </ul>
  <p><a href={base + "/projects"} class="btn-link">All projects →</a></p>
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
  .empty {
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
  }
  .project-list {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-4);
  }
  .project-list li {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .btn-link {
    font-size: var(--text-sm);
  }
</style>
