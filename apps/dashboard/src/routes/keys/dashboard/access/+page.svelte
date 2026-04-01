<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import { invalidateAll } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import type { KeyWithProject } from "./+page.server";
  import { gatewayKeyEnvSnippet } from "$lib/env-snippet";

  export let data: {
    signedIn: boolean;
    projects: { id: string; name: string }[];
    keys: KeyWithProject[];
    workspaceId: string | null;
    error: string | null;
    keysBaseUrl: string;
  };

  let creating = false;
  let createError = "";
  let selectedProjectId = data.projects[0]?.id ?? "";
  let createLabel = "";
  let newKey: { rawKey: string; keyPrefix: string; projectName: string; projectId: string } | null = null;
  let copied = false;
  let copiedEnv = false;
  let copiedMaskedId: string | null = null;
  let revokingId: string | null = null;
  let keyLabels: Record<string, string> = {};
  let listProjectFilter = "all";

  if (typeof localStorage !== "undefined") {
    try {
      keyLabels = JSON.parse(localStorage.getItem("rk_key_labels") ?? "{}");
    } catch {
      keyLabels = {};
    }
  }

  $: selectedProjectId = data.projects.length && !selectedProjectId
    ? data.projects[0].id
    : selectedProjectId;
  $: filteredKeys =
    listProjectFilter === "all"
      ? data.keys
      : data.keys.filter((key) => key.projectId === listProjectFilter);

  async function createGatewayKey() {
    if (!selectedProjectId) return;
    creating = true;
    createError = "";
    newKey = null;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${selectedProjectId}/keys`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data) {
        const project = data.projects.find((p) => p.id === selectedProjectId);
        newKey = {
          rawKey: body.data.rawKey,
          keyPrefix: body.data.keyPrefix,
          projectName: project?.name ?? "Project",
          projectId: selectedProjectId,
        };
        if (createLabel.trim()) {
          keyLabels[body.data.keyPrefix] = createLabel.trim();
          localStorage.setItem("rk_key_labels", JSON.stringify(keyLabels));
        }
        createLabel = "";
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

  function copyEnvSnippet() {
    if (!newKey) return;
    const text = gatewayKeyEnvSnippet(newKey.rawKey, newKey.projectId, data.keysBaseUrl);
    navigator.clipboard.writeText(text);
    copiedEnv = true;
    setTimeout(() => (copiedEnv = false), 2000);
  }

  async function copyMaskedId(key: KeyWithProject) {
    try {
      await navigator.clipboard.writeText(key.keyPrefix);
      copiedMaskedId = key.id;
      setTimeout(() => {
        if (copiedMaskedId === key.id) copiedMaskedId = null;
      }, 1500);
    } catch {
      // ignore clipboard errors
    }
  }

  async function revokeKey(key: KeyWithProject) {
    if (!confirm("Revoke this Gateway key? It will stop working immediately.")) return;
    revokingId = key.id;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${key.projectId}/keys`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: key.id }),
        credentials: "include",
      });
      if (res.ok) await invalidateAll();
    } finally {
      revokingId = null;
    }
  }
</script>

<h1 class="page-title">Gateway keys</h1>
<p class="page-desc">
  Gateway keys are your backend credentials for Restormel Keys programmatic access (Resolve, policy evaluate, and routes/steps APIs). Dashboard access is via GitHub sign-in. Provider credentials are separate — see Connections.
</p>
<p class="page-desc page-desc-secondary">
  <strong>API portal</strong> (Zuplo): Gateway API reference, Try it, and your Zuplo consumer key (<code class="inline-code">zpka_…</code>) — <a href={developerPortalUrl()} target="_blank" rel="noopener noreferrer">open API portal</a>. Use the portal nav or logo to return to Keys, Docs, or this dashboard.
</p>

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else}
  <section class="section" aria-labelledby="gateway-keys-heading">
    <h2 id="gateway-keys-heading" class="section-title">Your Gateway keys</h2>
    <a href={DASHBOARD_BASE + "/access/audit"} class="audit-link">View key history →</a>
    <p class="key-callout">
      A Gateway key authenticates your app to Restormel. It is not a provider credential.
      To connect OpenAI, Anthropic, or other providers, go to
      <a href={DASHBOARD_BASE + "/integrations"}>Connections</a>.
    </p>
    <p class="cli-hint">
      <strong>Terminal setup:</strong>
      run <code class="inline-code">npx @restormel/keys-cli login</code> and approve in
      <a href={DASHBOARD_BASE + "/cli/connect"}>Connect CLI</a>, or copy an env snippet after creating a key below.
    </p>

    {#if newKey}
      <div class="new-key-box" role="status" aria-live="polite">
        <p class="new-key-label">New key for {newKey.projectName} — copy now:</p>
          <p class="new-key-warning">This is the only time the full key will be shown.</p>
        <code class="new-key-value">{newKey.rawKey}</code>
        <div class="new-key-actions">
          <button type="button" class="btn btn-secondary" onclick={copyNewKey}>
            {copied ? "Copied key" : "Copy key only"}
          </button>
          <button type="button" class="btn btn-secondary" onclick={copyEnvSnippet}>
            {copiedEnv ? "Copied" : "Copy .env snippet"}
          </button>
        </div>
      </div>
    {/if}

    {#if createError}
      <p class="error-msg" role="alert">{createError}</p>
    {/if}

    {#if data.keys.length === 0 && !newKey}
      <EmptyState
        title="No Gateway keys yet"
        description="Create a Gateway key to use the Cloud API. Choose a project and create a key; copy it when shown — we will not show it again."
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
            <label for="access-key-label" class="sr-only">Key label</label>
            <input id="access-key-label" bind:value={createLabel} class="select" placeholder="Key label (optional)" />
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
        <label for="access-key-label-2" class="sr-only">Key label</label>
        <input id="access-key-label-2" bind:value={createLabel} class="select" placeholder="Key label (optional)" />
        <button type="submit" class="btn btn-primary" disabled={creating}>
          {creating ? "Creating…" : "Create Gateway key"}
        </button>
      </form>

      {#if data.keys.length > 0}
        <div class="key-filter">
          <label for="key-project-filter">Project</label>
          <select id="key-project-filter" bind:value={listProjectFilter} class="select">
            <option value="all">All projects</option>
            {#each data.projects as project}
              <option value={project.id}>{project.name}</option>
            {/each}
          </select>
        </div>
        <ul class="key-list">
          {#each filteredKeys as k}
            <li class="key-row">
              <span class="key-meta">
                <code class="key-prefix">{k.keyPrefix}</code>
                {#if keyLabels[k.keyPrefix]}
                  <span class="key-project">{keyLabels[k.keyPrefix]}</span>
                {/if}
                <span class="key-project">{k.projectName}</span>
              </span>
              <span class="key-actions">
                <button
                  type="button"
                  class="btn btn-icon"
                  onclick={() => copyMaskedId(k)}
                  aria-label="Copy masked key identifier {k.keyPrefix}"
                  title="Copy masked ID"
                >
                  📋
                </button>
                {#if copiedMaskedId === k.id}
                  <span class="copied-hint">Copied masked ID</span>
                {/if}
                <button
                  type="button"
                  class="btn btn-danger"
                  onclick={() => revokeKey(k)}
                  disabled={revokingId === k.id}
                  aria-label="Revoke Gateway key {k.keyPrefix}"
                >
                  {revokingId === k.id ? "Revoking…" : "Revoke"}
                </button>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </section>

  <section class="section" aria-labelledby="dashboard-access-heading">
    <h2 id="dashboard-access-heading" class="section-title">Dashboard access</h2>
    <p class="section-desc">
      {#if data.signedIn}
        You’re signed in. Use the dashboard to configure projects, routes, policies, and integrations.
      {:else}
        Sign in with GitHub to configure projects, routes, policies, and integrations in the dashboard UI.
      {/if}
    </p>
    {#if data.signedIn}
      <a href={DASHBOARD_BASE + "/projects"} class="btn btn-secondary">Go to projects</a>
    {:else}
      <a href={DASHBOARD_BASE + "/login"} class="btn btn-secondary">Sign in</a>
    {/if}
  </section>

  <section class="section" aria-labelledby="provider-creds-heading">
    <h2 id="provider-creds-heading" class="section-title">Provider credentials</h2>
    <p class="section-desc">
      Provider credentials (OpenAI, Anthropic, etc.) are separate from API keys. By default, keep provider credentials in your own env vars or secret manager - not pasted into Restormel. See Provider access modes for the decision tree.
    </p>
    <a href="/keys/docs/guides/provider-access-modes" class="btn btn-secondary">Provider access modes</a>
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
  .page-desc-secondary {
    margin-top: calc(-1 * var(--space-2));
    padding: var(--space-3);
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    line-height: 1.5;
  }
  .page-desc-secondary a {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .inline-code {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    background: var(--rm-bg);
    border-radius: 4px;
    border: 1px solid var(--rm-border);
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
  .audit-link {
    display: inline-block;
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-sage);
    text-decoration: none;
  }
  .audit-link:hover {
    text-decoration: underline;
  }
  .key-callout {
    margin: 0 0 var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--rm-border);
    border-left: 4px solid var(--rm-sage);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: 1.45;
  }
  .key-callout a {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .cli-hint {
    margin: 0 0 var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.45;
  }
  .cli-hint a {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .new-key-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
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
  .new-key-warning {
    font-size: var(--text-xs);
    color: var(--coral-alert);
    margin: 0 0 var(--space-2);
  }
  .new-key-value {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
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
  .key-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .btn-icon {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--rm-muted);
    line-height: 1;
  }
  .copied-hint {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .key-filter {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-3);
  }
  .key-filter label {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .key-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .key-prefix {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
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
