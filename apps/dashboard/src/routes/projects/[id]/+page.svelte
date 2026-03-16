<script lang="ts">
  import { base } from "$app/paths";

  export let data: {
    project: { id: string; name: string } | null;
    keys: { id: string; keyPrefix: string }[];
    environments: { id: string; name: string; type: string }[];
    error?: string | null;
  };
</script>

{#if data.error}
  <p class="error" role="alert">{data.error}</p>
{:else if !data.project}
  <p class="error">Project not found.</p>
{:else}
  <h1 class="page-title">{data.project.name}</h1>
  <p class="page-desc">Project detail. Gateway keys are scoped to this project.</p>

  {#if data.environments?.length > 0}
    <section class="section">
      <h2 class="section-title">Environments</h2>
      <p class="section-desc">Deployment separation (dev, prod). Routes and keys can be scoped to an environment later.</p>
      <ul class="env-list">
        {#each data.environments as env}
          <li class="env-row">
            <span class="env-name">{env.name}</span>
            <span class="env-type">{env.type}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="section">
    <h2 class="section-title">Gateway keys</h2>
    <p class="section-desc">
      This project has {data.keys.length} Gateway key{data.keys.length === 1 ? "" : "s"}. Create, view, and revoke keys in Access.
    </p>
    <a href={base + "/access"} class="btn btn-primary">Manage keys in Access</a>
  </section>

  <p><a href={base + "/projects/" + data.project.id + "/usage"}>Usage (placeholder)</a></p>
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
  .btn-primary:hover {
    opacity: 0.95;
  }
  .env-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .env-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .env-name {
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .env-type {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    text-transform: lowercase;
  }
  .error {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
</style>
