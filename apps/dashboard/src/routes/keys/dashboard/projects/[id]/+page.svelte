<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { goto, invalidateAll } from "$app/navigation";

  export let data: {
    project: { id: string; name: string } | null;
    keys: { id: string; keyPrefix: string }[];
    environments: { id: string; name: string; type: string }[];
    error?: string | null;
  };

  let copiedId: string | null = null;
  const KEYS_BASE_DEFAULT = "https://restormel.dev";
  let editingName = "";
  let renaming = false;
  let deleting = false;
  let actionError = "";

  $: editingName = data.project?.name ?? "";

  function copyToClipboard(value: string, id: string) {
    navigator.clipboard.writeText(value);
    copiedId = id;
    setTimeout(() => (copiedId = null), 2000);
  }

  async function renameProject() {
    if (!data.project) return;
    const nextName = editingName.trim();
    if (!nextName) {
      actionError = "Project name cannot be empty.";
      return;
    }
    renaming = true;
    actionError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        actionError = err.detail || err.error || `Rename failed (${res.status})`;
        return;
      }
      await invalidateAll();
    } catch (e) {
      actionError = e instanceof Error ? e.message : "Rename failed";
    } finally {
      renaming = false;
    }
  }

  async function deleteCurrentProject() {
    if (!data.project) return;
    if (!confirm(`Delete project "${data.project.name}"? This action cannot be undone.`)) return;
    deleting = true;
    actionError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        actionError = err.detail || err.error || `Delete failed (${res.status})`;
        return;
      }
      await goto(DASHBOARD_BASE + "/projects");
    } catch (e) {
      actionError = e instanceof Error ? e.message : "Delete failed";
    } finally {
      deleting = false;
    }
  }
</script>

{#if data.error}
  <p class="error" role="alert">{data.error}</p>
{:else if !data.project}
  <p class="error">Project not found.</p>
{:else}
  <h1 class="page-title">{data.project.name}</h1>
  <p class="page-desc">Project detail. Gateway keys are scoped to this project.</p>
  {#if actionError}
    <p class="error" role="alert">{actionError}</p>
  {/if}

  <section class="section">
    <h2 class="section-title">Project settings</h2>
    <p class="section-desc">Rename or delete this project. Deleting a project also removes its associated Gateway keys.</p>
    <div class="project-settings-row">
      <label class="visually-hidden" for="project-rename-input">Project name</label>
      <input
        id="project-rename-input"
        type="text"
        bind:value={editingName}
        class="project-name-input"
        aria-label="Project name"
        disabled={renaming || deleting}
      />
      <button class="btn btn-secondary btn-sm" onclick={renameProject} disabled={renaming || deleting || !editingName.trim()}>
        {renaming ? "Saving..." : "Save name"}
      </button>
      <button class="btn btn-danger btn-sm" onclick={deleteCurrentProject} disabled={renaming || deleting}>
        {deleting ? "Deleting..." : "Delete project"}
      </button>
    </div>
  </section>

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

  <section id="ci-secrets" class="section section-ci-secrets" aria-labelledby="ci-secrets-heading">
    <h2 id="ci-secrets-heading" class="section-title">Copy for CI (GitHub Secrets)</h2>
    <p class="section-desc">
      Copy these into your repo’s <strong>Settings → Secrets and variables → Actions</strong>. Use a staging project and key for CI — never point CI at production unless you accept that risk.
    </p>
    <ul class="ci-secrets-list">
      <li class="ci-secret-row">
        <div class="ci-secret-meta">
          <code class="ci-secret-name">RESTORMEL_GATEWAY_KEY_STAGING</code>
          <span class="ci-secret-desc">A staging Gateway Key from Restormel Dashboard</span>
        </div>
        <div class="ci-secret-value">
          <span class="ci-secret-masked">Create a key in Access; copy it when shown. We don’t display full keys again.</span>
          <a href={DASHBOARD_BASE + "/access"} class="btn btn-secondary btn-sm">Create key in Access</a>
        </div>
      </li>
      <li class="ci-secret-row">
        <div class="ci-secret-meta">
          <code class="ci-secret-name">RESTORMEL_PROJECT_ID_STAGING</code>
          <span class="ci-secret-desc">The staging Restormel project ID</span>
        </div>
        <div class="ci-secret-value">
          <code class="ci-secret-display">{data.project.id}</code>
          <button type="button" class="btn btn-secondary btn-sm" onclick={() => copyToClipboard(data.project!.id, "project")}>
            {copiedId === "project" ? "Copied" : "Copy"}
          </button>
        </div>
      </li>
      <li class="ci-secret-row">
        <div class="ci-secret-meta">
          <code class="ci-secret-name">RESTORMEL_ENVIRONMENT_ID_STAGING</code>
          <span class="ci-secret-desc">The staging environment ID inside this project</span>
        </div>
        <div class="ci-secret-value">
          {#if data.environments?.length > 0}
            {#each data.environments as env}
              <span class="ci-secret-env">
                <code class="ci-secret-display">{env.id}</code>
                <button type="button" class="btn btn-secondary btn-sm" onclick={() => copyToClipboard(env.id, "env-" + env.id)}>
                  {copiedId === "env-" + env.id ? "Copied" : "Copy"} ({env.name})
                </button>
              </span>
            {/each}
          {:else}
            <span class="ci-secret-muted">No environments yet. Use project ID or create an environment.</span>
          {/if}
        </div>
      </li>
      <li class="ci-secret-row ci-secret-optional">
        <div class="ci-secret-meta">
          <code class="ci-secret-name">RESTORMEL_KEYS_BASE_STAGING</code>
          <span class="ci-secret-desc">Optional. Base URL for Keys API; only set if you use a different host.</span>
        </div>
        <div class="ci-secret-value">
          <code class="ci-secret-display">{KEYS_BASE_DEFAULT}</code>
          <button type="button" class="btn btn-secondary btn-sm" onclick={() => copyToClipboard(KEYS_BASE_DEFAULT, "base")}>
            {copiedId === "base" ? "Copied" : "Copy"}
          </button>
        </div>
      </li>
    </ul>
  </section>

  <section class="section">
    <h2 class="section-title">Gateway keys</h2>
    <p class="section-desc">
      This project has {data.keys.length} Gateway key{data.keys.length === 1 ? "" : "s"}. Create, view, and revoke keys in Access.
    </p>
    <a href={DASHBOARD_BASE + "/access"} class="btn btn-primary">Manage keys in Access</a>
  </section>

  <p><a href={DASHBOARD_BASE + "/projects/" + data.project.id + "/usage"}>Usage (placeholder)</a></p>
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
  .project-settings-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .project-name-input {
    min-width: 14rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    color: var(--rm-text);
    font-size: var(--text-sm);
  }

  .section-ci-secrets {
    background: color-mix(in oklab, var(--rm-surface-raised, var(--rm-surface)) 90%, black 10%);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }
  .ci-secrets-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .ci-secret-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .ci-secret-row:last-child {
    border-bottom: none;
  }
  .ci-secret-optional {
    opacity: 0.9;
  }
  .ci-secret-meta {
    flex: 1 1 12rem;
    min-width: 0;
  }
  .ci-secret-name {
    display: block;
    font-size: var(--text-sm);
    color: var(--rm-text);
    margin-bottom: var(--space-1);
  }
  .ci-secret-desc {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .ci-secret-value {
    flex: 1 1 14rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .ci-secret-masked {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin-right: var(--space-2);
  }
  .ci-secret-display {
    font-size: var(--text-sm);
    color: var(--rm-text);
    word-break: break-all;
  }
  .ci-secret-env {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin-right: var(--space-3);
  }
  .ci-secret-muted {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .btn-sm {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
  }
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .btn-secondary:hover {
    opacity: 0.9;
  }
  .btn-danger {
    background: color-mix(in oklab, var(--coral-alert) 90%, black 10%);
    color: white;
    border: 1px solid color-mix(in oklab, var(--coral-alert) 70%, black 30%);
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
