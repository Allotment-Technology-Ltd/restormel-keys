<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { invalidateAll } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import type { KeyWithProject } from "./+page.server";

  export let data: {
    projects: { id: string; name: string }[];
    keys: KeyWithProject[];
    workspaceId: string | null;
    error: string | null;
  };

  let creating = false;
  let createError = "";
  let selectedProjectId = data.projects[0]?.id ?? "";
  let newKey: { rawKey: string; keyPrefix: string; projectName: string } | null = null;
  let copied = false;
  let revokingId: string | null = null;

  $: selectedProjectId = data.projects.length && !selectedProjectId
    ? data.projects[0].id
    : selectedProjectId;

  async function createGatewayKey() {
    if (!selectedProjectId) return;
    creating = true;
    createError = "";
    newKey = null;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${selectedProjectId}/keys`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data) {
        const project = data.projects.find((p) => p.id === selectedProjectId);
        newKey = {
          rawKey: body.data.rawKey,
          keyPrefix: body.data.keyPrefix,
          projectName: project?.name ?? "Project",
        };
        await invalidateAll();
      } else {
        createError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      createError = e instanceof Error ? e.message : "Request failed";
    } finally {
      creating = false;
    }
  }

  function copyNewKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.rawKey);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  async function revokeKey(key: KeyWithProject) {
    if (!confirm("Revoke this Gateway key? It will stop working immediately.")) return;
    revokingId = key.id;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${key.projectId}/keys`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: key.id }),
      });
      if (res.ok) await invalidateAll();
    } finally {
      revokingId = null;
    }
  }
</script>

<h1 class="page-title">Access</h1>
<p class="page-desc">
  Manage how you and your apps access the Restormel API: Gateway keys (for the Cloud API) and Management keys (for workspace automation). Provider credentials are separate — see Provider Integrations.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else}
  <section class="section" aria-labelledby="gateway-keys-heading">
    <h2 id="gateway-keys-heading" class="section-title">Gateway keys</h2>
    <p class="section-desc">
      A Gateway key lets you call the Restormel Cloud API. Each key belongs to one project. Copy the key when you create it; we won’t show the full key again. This is not a Provider credential — those are for connecting to AI providers and live under Provider Integrations.
    </p>

    {#if newKey}
      <div class="new-key-box" role="status" aria-live="polite">
        <p class="new-key-label">New key for {newKey.projectName} — copy now:</p>
        <code class="new-key-value">{newKey.rawKey}</code>
        <button type="button" class="btn btn-secondary" onclick={copyNewKey}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    {/if}

    {#if createError}
      <p class="error-msg" role="alert">{createError}</p>
    {/if}

    {#if data.keys.length === 0 && !newKey}
      <EmptyState
        title="No Gateway keys yet"
        description="Create a Gateway key to use the Cloud API. Choose a project and create a key; copy it when shown — we won’t show it again."
      >
        {#if data.projects.length === 0}
          <a href={DASHBOARD_BASE + "/projects"} class="btn btn-primary">Create a project first</a>
        {:else}
          <form class="create-key-form" onsubmit={(e) => { e.preventDefault(); createGatewayKey(); }}>
            <label for="access-project-select" class="sr-only">Project</label>
            <select id="access-project-select" bind:value={selectedProjectId} class="select">
              {#each data.projects as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
            <button type="submit" class="btn btn-primary" disabled={creating}>
              {creating ? "Creating…" : "Create Gateway key"}
            </button>
          </form>
        {/if}
      </EmptyState>
    {:else}
      <form class="create-key-form" onsubmit={(e) => { e.preventDefault(); createGatewayKey(); }}>
        <label for="access-project-select-2" class="sr-only">Project for new key</label>
        <select id="access-project-select-2" bind:value={selectedProjectId} class="select">
          {#each data.projects as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
        <button type="submit" class="btn btn-primary" disabled={creating}>
          {creating ? "Creating…" : "Create Gateway key"}
        </button>
      </form>

      {#if data.keys.length > 0}
        <ul class="key-list">
          {#each data.keys as k}
            <li class="key-row">
              <span class="key-meta">
                <code class="key-prefix">{k.keyPrefix}</code>
                <span class="key-project">{k.projectName}</span>
              </span>
              <button
                type="button"
                class="btn btn-danger"
                onclick={() => revokeKey(k)}
                disabled={revokingId === k.id}
                aria-label="Revoke Gateway key {k.keyPrefix}"
              >
                {revokingId === k.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </section>

  <section class="section" aria-labelledby="management-keys-heading">
    <h2 id="management-keys-heading" class="section-title">Management keys</h2>
    <p class="section-desc">
      Management keys are for workspace-level automation and admin APIs. They are not the same as Gateway keys (which are for the Cloud API per project). Management keys are coming soon.
    </p>
    <p class="placeholder-note">No Management keys yet. This feature is not yet available.</p>
  </section>

  <section class="section" aria-labelledby="audit-heading">
    <h2 id="audit-heading" class="section-title">Audit log</h2>
    <p class="section-desc">
      View who created or revoked keys and other changes in your workspace.
    </p>
    <a href={DASHBOARD_BASE + "/access/audit"} class="btn btn-secondary">View audit log</a>
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
  .placeholder-note {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    font-style: italic;
    margin: 0;
  }
  .new-key-box {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }
  .new-key-label {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin: 0 0 var(--space-1);
  }
  .new-key-value {
    font-size: var(--text-sm);
    word-break: break-all;
    display: block;
    margin-bottom: var(--space-2);
  }
  .create-key-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .select {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-text);
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
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .btn-danger {
    background: transparent;
    color: var(--rm-muted);
    border: 1px solid var(--rm-border);
  }
  .btn-danger:hover:not(:disabled) {
    color: var(--coral-alert);
    border-color: var(--coral-alert);
  }
  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .key-list {
    list-style: none;
    padding: 0;
    margin: var(--space-4) 0 0;
  }
  .key-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
  }
  .key-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .key-prefix {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .key-project {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .sr-only {
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
