<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let data: { project: { id: string; name: string } | null; error?: string | null };
</script>

{#if data.error}
  <p class="error" role="alert">{data.error}</p>
{:else if !data.project}
  <p class="error">Project not found.</p>
{:else}
  <h1 class="page-title">Usage</h1>
  <p class="page-desc">{data.project.name} — per-project usage views are still minimal.</p>
  <p class="placeholder">
    Organisation-wide <strong>requests over time</strong>, <strong>cost by model</strong>, and aggregates live on
    <a href={DASHBOARD_BASE + "/analytics"}>Analytics</a>. This page will gain project-scoped charts when wired.
  </p>
  <p><a href={DASHBOARD_BASE + "/projects/" + data.project.id}>← Back to project</a></p>
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
  .placeholder {
    color: var(--rm-dim);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
  }
  .placeholder a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .error {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
</style>
