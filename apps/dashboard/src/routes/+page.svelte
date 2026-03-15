<script lang="ts">
  import { base } from "$app/paths";

  export let data: { projects: { id: string; name: string }[] };
</script>

<h1 class="page-title">Overview</h1>
<p class="page-desc">Your projects and quick stats.</p>

{#if data.projects.length === 0}
  <p class="empty">No projects yet. <a href={base + "/projects"}>Create one</a>.</p>
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
  .empty {
    color: var(--rm-muted);
    margin: 0 0 1rem;
  }
  .project-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
  }
  .project-list li {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .btn-link {
    font-size: 0.875rem;
  }
</style>
