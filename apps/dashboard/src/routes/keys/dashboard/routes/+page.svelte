<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import EmptyState from "$lib/components/EmptyState.svelte";

  export let data: {
    projects: { id: string; name: string }[];
    error: string | null;
  };
</script>

<h1 class="page-title">Routes</h1>
<p class="page-desc">
  A route defines how requests are handled in a project and environment: which model to use, fallback behaviour, and billing mode. Routes are first-class: create one per environment, then configure steps and policies.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else if data.projects.length === 0}
  <EmptyState
    title="No projects yet"
    description="Create a project first. Routes belong to a project and an environment."
  >
    <a href={base + "/projects"} class="btn btn-primary">Go to Projects</a>
  </EmptyState>
{:else}
  <section class="section" aria-labelledby="projects-heading">
    <h2 id="projects-heading" class="section-title">Select a project</h2>
    <p class="section-desc">Manage routes for a project. Each project has environments; routes are scoped to an environment.</p>
    <ul class="project-list">
      {#each data.projects as p}
        <li>
          <a href={DASHBOARD_BASE + "/projects/" + p.id + "/routes"} class="project-link">{p.name}</a>
          <span class="project-meta">Manage routes</span>
        </li>
      {/each}
    </ul>
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
  .section {
    margin-bottom: var(--space-6);
  }
  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-1);
  }
  .section-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }
  .project-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .project-list li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .project-link {
    font-weight: 500;
    color: var(--rm-sage);
    text-decoration: none;
  }
  .project-link:hover {
    text-decoration: underline;
  }
  .project-meta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    text-decoration: none;
    display: inline-block;
    border: none;
    cursor: pointer;
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
</style>
