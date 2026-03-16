<script lang="ts">
  import { base } from "$app/paths";
  import { invalidateAll } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";

  export let data: { projects: { id: string; name: string; createdAt: number }[]; projectsError?: string | null };

  let creating = false;
  let newName = "";
  let createError = "";

  async function createProject() {
    if (!newName.trim()) return;
    creating = true;
    createError = "";
    try {
      const res = await fetch(`${base}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
        credentials: "include",
      });
      if (res.ok) {
        const { data: project } = await res.json();
        newName = "";
        await invalidateAll();
        window.location.href = base + "/projects/" + project.id;
      } else {
        const err = await res.json().catch(() => ({}));
        createError = (err as { error?: string }).error || `Create failed (${res.status})`;
      }
    } catch (e) {
      createError = e instanceof Error ? e.message : "Create failed";
    } finally {
      creating = false;
    }
  }
</script>

<h1 class="page-title">Projects</h1>
<p class="page-desc">Create and manage projects. Each project has its own Gateway keys.</p>

{#if data.projectsError}
  <p class="error-msg" role="alert">{data.projectsError}. Check Vercel logs for database errors.</p>
{/if}
{#if createError}
  <p class="error-msg" role="alert">{createError}</p>
{/if}
<div class="create-form" id="create-form">
  <input type="text" bind:value={newName} placeholder="Project name" class="input" />
  <button class="btn btn-primary" onclick={createProject} disabled={creating || !newName.trim()}>
    {creating ? "Creating…" : "Create project"}
  </button>
</div>

{#if data.projects.length === 0}
  <EmptyState
    title="No projects yet"
    description="Create your first project to get Gateway keys and use the Cloud API."
  >
    <a href="#create-form" class="btn btn-primary">Create a project</a>
  </EmptyState>
{:else}
  <ul class="project-list">
    {#each data.projects as p}
      <li>
        <a href={base + "/projects/" + p.id}>{p.name}</a>
      </li>
    {/each}
  </ul>
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
  .create-form {
    display: flex;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }
  .input {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    color: var(--rm-text);
    font-family: inherit;
    font-size: var(--text-sm);
    min-width: 12rem;
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
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
</style>
