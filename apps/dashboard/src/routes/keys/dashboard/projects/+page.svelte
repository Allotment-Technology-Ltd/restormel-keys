<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";

  export let data: { projects: { id: string; name: string; createdAt: number }[]; projectsError?: string | null };

  let creating = false;
  let newName = "";
  let createError = "";
  let projectActionError = "";
  let editingProjectId = "";
  let renameValue = "";
  let renamingProjectId = "";
  let deletingProjectId = "";

  async function createProject() {
    if (!newName.trim()) return;
    creating = true;
    createError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
        credentials: "include",
      });
      if (res.ok) {
        const { data: project } = await res.json();
        newName = "";
        await invalidateAll();
        window.location.href = DASHBOARD_BASE + "/projects/" + project.id;
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        createError = err.detail || err.error || `Create failed (${res.status})`;
      }
    } catch (e) {
      createError = e instanceof Error ? e.message : "Create failed";
    } finally {
      creating = false;
    }
  }

  function startRename(projectId: string, currentName: string) {
    editingProjectId = projectId;
    renameValue = currentName;
    projectActionError = "";
  }

  function cancelRename() {
    editingProjectId = "";
    renameValue = "";
  }

  async function saveRename(projectId: string) {
    const nextName = renameValue.trim();
    if (!nextName) {
      projectActionError = "Project name cannot be empty.";
      return;
    }
    renamingProjectId = projectId;
    projectActionError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        projectActionError = err.detail || err.error || `Rename failed (${res.status})`;
        return;
      }
      await invalidateAll();
      cancelRename();
    } catch (e) {
      projectActionError = e instanceof Error ? e.message : "Rename failed";
    } finally {
      renamingProjectId = "";
    }
  }

  async function removeProject(projectId: string, projectName: string) {
    if (!confirm(`Delete project "${projectName}"? This action cannot be undone.`)) return;
    deletingProjectId = projectId;
    projectActionError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        projectActionError = err.detail || err.error || `Delete failed (${res.status})`;
        return;
      }
      await invalidateAll();
      if (editingProjectId === projectId) cancelRename();
    } catch (e) {
      projectActionError = e instanceof Error ? e.message : "Delete failed";
    } finally {
      deletingProjectId = "";
    }
  }
</script>

<h1 class="page-title">Projects</h1>
<p class="page-desc">Create and manage projects. Each project has its own Gateway keys.</p>

{#if data.projectsError}
  <p class="error-msg" role="alert">{data.projectsError}. <a href="/keys/dashboard/projects" data-sveltekit-reload>Try again</a>, or contact support if it keeps happening.</p>
{/if}
{#if createError}
  <p class="error-msg" role="alert">{createError}</p>
{/if}
{#if projectActionError}
  <p class="error-msg" role="alert">{projectActionError}</p>
{/if}
<div class="create-form" id="create-form">
  <label class="visually-hidden" for="project-name-input">Project name</label>
  <input id="project-name-input" type="text" bind:value={newName} placeholder="Project name" class="input" />
  <button class="btn btn-primary" on:click={createProject} disabled={creating || !newName.trim()}>
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
        <div class="project-row">
          <div class="project-main">
            <a href={DASHBOARD_BASE + "/projects/" + p.id}>{p.name}</a>
            <span class="project-id"><code>{p.id.slice(0, 8)}...</code></span>
          </div>
          <div class="project-actions">
            {#if editingProjectId === p.id}
              <input
                class="input input-rename"
                type="text"
                bind:value={renameValue}
                aria-label="Rename project"
                disabled={renamingProjectId === p.id || deletingProjectId === p.id}
              />
              <button
                class="btn btn-secondary btn-sm"
                on:click={() => saveRename(p.id)}
                disabled={renamingProjectId === p.id || deletingProjectId === p.id || !renameValue.trim()}
              >
                {renamingProjectId === p.id ? "Saving..." : "Save"}
              </button>
              <button class="btn btn-tertiary btn-sm" on:click={cancelRename} disabled={renamingProjectId === p.id || deletingProjectId === p.id}>
                Cancel
              </button>
            {:else}
              <button class="btn btn-secondary btn-sm" on:click={() => startRename(p.id, p.name)} disabled={deletingProjectId === p.id}>Rename</button>
              <button
                class="btn btn-danger btn-sm"
                on:click={() => removeProject(p.id, p.name)}
                disabled={deletingProjectId === p.id || renamingProjectId === p.id}
              >
                {deletingProjectId === p.id ? "Deleting..." : "Delete"}
              </button>
            {/if}
          </div>
        </div>
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
    border: var(--border-thin);
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
    border-bottom: var(--border-thin);
  }
  .project-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .project-main {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 12rem;
  }
  .project-id {
    color: var(--rm-dim);
    font-size: var(--text-xs);
  }
  .project-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .btn-sm {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
  }
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: var(--border-thin);
  }
  .btn-tertiary {
    background: transparent;
    color: var(--rm-muted);
    border: var(--border-thin);
  }
  .btn-danger {
    background: color-mix(in oklab, var(--coral-alert) 90%, black 10%);
    color: white;
  }
  .input-rename {
    min-width: 10rem;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
