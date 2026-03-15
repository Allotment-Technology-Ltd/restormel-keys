<script lang="ts">
  import { base } from "$app/paths";
  import { invalidateAll } from "$app/navigation";

  export let data: { projects: { id: string; name: string; createdAt: number }[]; projectsError?: string | null };

  let creating = false;
  let newName = "";

  async function createProject() {
    if (!newName.trim()) return;
    creating = true;
    try {
      const res = await fetch(`${base}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const { data: project } = await res.json();
        newName = "";
        await invalidateAll();
        window.location.href = base + "/projects/" + project.id;
      }
    } finally {
      creating = false;
    }
  }
</script>

<h1 class="page-title">Projects</h1>
<p class="page-desc">Create and manage projects. Each project has its own API keys.</p>

{#if data.projectsError}
  <p class="error-msg" role="alert">{data.projectsError}. Check Cloud Run logs; Firestore may need to be enabled or the service account may need Firestore permissions.</p>
{/if}
<div class="create-form">
  <input type="text" bind:value={newName} placeholder="Project name" class="input" />
  <button class="btn btn-primary" onclick={createProject} disabled={creating || !newName.trim()}>
    {creating ? "Creating…" : "Create project"}
  </button>
</div>

<ul class="project-list">
  {#each data.projects as p}
    <li>
      <a href={base + "/projects/" + p.id}>{p.name}</a>
    </li>
  {/each}
</ul>

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
  .error-msg {
    color: var(--rm-error, #c95c5c);
    font-size: 0.875rem;
    margin: 0 0 1rem;
  }
  .create-form {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  .input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    color: var(--rm-text);
    font-family: inherit;
    font-size: 0.875rem;
    min-width: 12rem;
  }
  .btn {
    padding: 0.5rem 1rem;
    border-radius: var(--rm-radius);
    font-size: 0.875rem;
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
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--rm-border);
  }
</style>
