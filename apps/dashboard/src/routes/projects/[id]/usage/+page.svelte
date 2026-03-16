<script lang="ts">
  import { base } from "$app/paths";

  export let data: { project: { id: string; name: string } | null; error?: string | null };
</script>

{#if data.error}
  <p class="error" role="alert">{data.error}</p>
{:else if !data.project}
  <p class="error">Project not found.</p>
{:else}
  <h1 class="page-title">Usage</h1>
  <p class="page-desc">{data.project.name} — usage and cost. (Placeholder; Phase 4.)</p>
  <p class="placeholder">Usage graphs and cost breakdown will be added in Phase 4.</p>
  <p><a href={base + "/projects/" + data.project.id}>← Back to project</a></p>
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
  .placeholder {
    color: var(--rm-dim);
    font-size: 0.875rem;
  }
  .error {
    color: #c95c5c;
  }
</style>
