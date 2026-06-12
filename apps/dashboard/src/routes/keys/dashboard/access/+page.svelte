<script lang="ts">
  /**
   * W3.7 + K1 — Team-shared gateway key metadata.
   *
   * Before: labels stored in localStorage keyed by prefix; invisible to teammates,
   *         vanished on a different browser. created_at dropped; last_used_at never shown.
   * After:  server-persisted label, created relative date, last-used relative date.
   *         One-time localStorage migration offer (never auto-write silently).
   *         Inline rename via PATCH endpoint.
   *
   * Source types: ApiKeyWithProject from +page.server.ts (derived from neon.ts ApiKeyWithProject).
   */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import { invalidateAll } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import type { ApiKeyWithProject } from "./+page.server";
  import { gatewayKeyEnvSnippet } from "$lib/env-snippet";
  import { savePendingGatewayKeySession } from "$lib/connect/connect-gateway-key-storage";

  export let data: {
    signedIn: boolean;
    projects: { id: string; name: string }[];
    keys: ApiKeyWithProject[];
    workspaceId: string | null;
    error: string | null;
    keysBaseUrl: string;
  };

  let creating = false;
  let createError = "";
  let selectedProjectId = data.projects[0]?.id ?? "";
  let createLabel = "";
  let newKey: {
    rawKey: string;
    keyPrefix: string;
    projectName: string;
    projectId: string;
    keyId: string;
  } | null = null;
  let copied = false;
  let copiedEnv = false;
  let copiedMaskedId: string | null = null;
  let revokingId: string | null = null;
  let listProjectFilter = "all";

  // Inline rename state (W3.7/K1).
  let renamingId: string | null = null;
  let renameValue = "";
  let renameError = "";
  let renameSaving = false;

  // localStorage migration offer (W3.7/K1 — K-P1-1).
  // Read once on mount; never auto-write.
  let legacyLabels: Record<string, string> = {};
  let showMigrationOffer = false;
  let migrationPending = false;
  let migrationDone = false;

  if (typeof localStorage !== "undefined") {
    try {
      legacyLabels = JSON.parse(localStorage.getItem("rk_key_labels") ?? "{}") as Record<string, string>;
      // Offer migration if: there are legacy labels AND some keys have no server label yet.
      const unmigratedCount = data.keys.filter(
        (k) => !k.label && legacyLabels[k.keyPrefix]
      ).length;
      showMigrationOffer = unmigratedCount > 0;
    } catch {
      legacyLabels = {};
    }
  }

  $: selectedProjectId = data.projects.length && !selectedProjectId
    ? data.projects[0].id
    : selectedProjectId;

  $: filteredKeys =
    listProjectFilter === "all"
      ? data.keys
      : data.keys.filter((key) => key.projectId === listProjectFilter);

  // Helper: format relative time (last used / created).
  function relativeTime(ms: number | null): string {
    if (ms == null) return "never";
    const diff = Date.now() - ms;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return new Date(ms).toLocaleDateString();
  }

  // Helper: display label — server label wins; honest absent state for pre-W3.7 keys.
  function displayLabel(k: ApiKeyWithProject): string | null {
    return k.label ?? null;
  }

  async function createGatewayKey() {
    if (!selectedProjectId) return;
    creating = true;
    createError = "";
    newKey = null;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${selectedProjectId}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // W3.7/K1: send label in body (was: no body sent — K-P1-1 evidence).
        body: JSON.stringify({ label: createLabel.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data) {
        const project = data.projects.find((p) => p.id === selectedProjectId);
        const keyId = typeof body.data.keyId === "string" ? body.data.keyId : "";
        newKey = {
          rawKey: body.data.rawKey,
          keyPrefix: body.data.keyPrefix,
          projectName: project?.name ?? "Project",
          projectId: selectedProjectId,
          keyId,
        };
        if (keyId) {
          savePendingGatewayKeySession({
            keyId,
            rawKey: body.data.rawKey,
            keyPrefix: body.data.keyPrefix,
            projectId: selectedProjectId,
            savedAt: Date.now(),
          });
        }
        createLabel = "";
        await invalidateAll();
        // Recheck migration offer after reload.
        if (typeof localStorage !== "undefined") {
          try {
            legacyLabels = JSON.parse(localStorage.getItem("rk_key_labels") ?? "{}") as Record<string, string>;
          } catch { legacyLabels = {}; }
        }
      } else {
        createError = (body as { error?: string; message?: string }).message
          ?? (body as { error?: string }).error
          ?? `Request failed (${res.status})`;
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

  async function copyMaskedId(key: ApiKeyWithProject) {
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

  async function revokeKey(key: ApiKeyWithProject) {
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

  // Inline rename helpers (W3.7/K1).
  function startRename(key: ApiKeyWithProject) {
    renamingId = key.id;
    renameValue = key.label ?? "";
    renameError = "";
  }

  function cancelRename() {
    renamingId = null;
    renameValue = "";
    renameError = "";
  }

  async function saveRename(key: ApiKeyWithProject) {
    if (renameSaving) return;
    renameSaving = true;
    renameError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${key.projectId}/keys`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keyId: key.id, label: renameValue.trim() || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        renamingId = null;
        renameValue = "";
        await invalidateAll();
      } else {
        renameError = (body as { message?: string }).message ?? `Failed (${res.status})`;
      }
    } catch (e) {
      renameError = e instanceof Error ? e.message : "Request failed";
    } finally {
      renameSaving = false;
    }
  }

  // localStorage migration (W3.7/K1): batch-save local labels to server for unlabelled keys.
  // Never auto-writes; only fires on explicit user action.
  async function migrateLocalLabels() {
    if (migrationPending) return;
    migrationPending = true;
    const toMigrate = data.keys.filter((k) => !k.label && legacyLabels[k.keyPrefix]);
    let ok = true;
    for (const k of toMigrate) {
      try {
        const res = await fetch(`${DASHBOARD_BASE}/api/projects/${k.projectId}/keys`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ keyId: k.id, label: legacyLabels[k.keyPrefix] }),
        });
        if (!res.ok) { ok = false; }
      } catch { ok = false; }
    }
    if (ok) {
      // Clear the legacy store and hide the offer.
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("rk_key_labels");
      }
      legacyLabels = {};
      showMigrationOffer = false;
      migrationDone = true;
      await invalidateAll();
    }
    migrationPending = false;
  }

  function dismissMigrationOffer() {
    showMigrationOffer = false;
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
    <a href={DASHBOARD_BASE + "/prove/audit"} class="audit-link">View key history →</a>
    <p class="key-callout">
      A Gateway key authenticates your app to Restormel. It is not a provider credential.
      To connect OpenAI, Anthropic, Mistral, Together, Voyage, or other providers, go to
      <a href={DASHBOARD_BASE + "/integrations"}>Connections</a>.
    </p>
    <p class="cli-hint">
      <strong>Terminal setup:</strong>
      run <code class="inline-code">npx @restormel/keys-cli login</code> and approve in
      <a href={DASHBOARD_BASE + "/cli/connect"}>Connect CLI</a>, or copy an env snippet after creating a key below.
    </p>

    {#if showMigrationOffer && !migrationDone}
      {@const unmigratedCount = data.keys.filter((k) => !k.label && legacyLabels[k.keyPrefix]).length}
      <div class="migration-banner" role="status" aria-live="polite">
        <span class="migration-text">
          We found {unmigratedCount} {unmigratedCount === 1 ? "label" : "labels"} saved in this browser — save {unmigratedCount === 1 ? "it" : "them"} to your workspace so teammates can see {unmigratedCount === 1 ? "it" : "them"} too.
        </span>
        <div class="migration-actions">
          <button type="button" class="btn btn-primary btn-sm" onclick={migrateLocalLabels} disabled={migrationPending}>
            {migrationPending ? "Saving…" : `Save ${unmigratedCount} ${unmigratedCount === 1 ? "label" : "labels"} to workspace`}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick={dismissMigrationOffer}>
            Dismiss
          </button>
        </div>
      </div>
    {/if}

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
          <a class="btn btn-primary" href={DASHBOARD_BASE + "/agents"}>Use in MCP setup</a>
        </div>
      </div>
    {/if}

    {#if createError}
      <p class="error-msg" role="alert">{createError}</p>
    {/if}

    {#if data.keys.length === 0 && !newKey}
      <EmptyState
        title="No Gateway keys yet"
        description="Create a Gateway key to use the Cloud API. Choose a project and optionally add a label so teammates can identify it. Copy the key when shown — we will not show it again."
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
            <input id="access-key-label" bind:value={createLabel} class="select" placeholder="Key label (optional)" maxlength="120" />
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
        <input id="access-key-label-2" bind:value={createLabel} class="select" placeholder="Key label (optional)" maxlength="120" />
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
        <ul class="key-list" aria-label="Gateway keys">
          {#each filteredKeys as k (k.id)}
            <li class="key-row">
              <span class="key-meta">
                <code class="key-prefix">{k.keyPrefix}</code>
                {#if renamingId === k.id}
                  <!-- Inline rename form (W3.7/K1) -->
                  <form
                    class="rename-form"
                    onsubmit={(e) => { e.preventDefault(); saveRename(k); }}
                    aria-label="Rename key {k.keyPrefix}"
                  >
                    <label for="rename-{k.id}" class="sr-only">New label for {k.keyPrefix}</label>
                    <input
                      id="rename-{k.id}"
                      class="rename-input"
                      bind:value={renameValue}
                      placeholder="Label (leave blank to clear)"
                      maxlength="120"
                      aria-describedby={renameError ? "rename-error-{k.id}" : undefined}
                    />
                    <button type="submit" class="btn btn-primary btn-sm" disabled={renameSaving}>
                      {renameSaving ? "Saving…" : "Save"}
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick={cancelRename}>Cancel</button>
                    {#if renameError}
                      <span id="rename-error-{k.id}" class="rename-error" role="alert">{renameError}</span>
                    {/if}
                  </form>
                {:else}
                  {@const label = displayLabel(k)}
                  {#if label}
                    <span class="key-label">{label}</span>
                  {:else}
                    <span class="key-label key-label-absent" aria-label="No label — click Rename to add one">Unlabelled</span>
                  {/if}
                  <span class="key-project">{k.projectName}</span>
                {/if}
              </span>
              <!-- Metadata: created + last used (W3.7/K1) -->
              <span class="key-times" aria-label="Key created {relativeTime(k.createdAt)}, last used {relativeTime(k.lastUsedAt)}">
                <span class="key-time-item" title="Created">
                  <span class="key-time-label">created</span>
                  <span class="key-time-value">{relativeTime(k.createdAt)}</span>
                </span>
                <span class="key-time-item" title="Last used">
                  <span class="key-time-label">last used</span>
                  <span class="key-time-value">{relativeTime(k.lastUsedAt)}</span>
                </span>
              </span>
              <span class="key-actions">
                {#if renamingId !== k.id}
                  <button
                    type="button"
                    class="btn btn-icon"
                    onclick={() => startRename(k)}
                    aria-label="Rename key {k.keyPrefix}"
                    title="Rename"
                  >
                    ✏️
                  </button>
                {/if}
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
        You're signed in. Use the dashboard to configure projects, routes, policies, and connections.
      {:else}
        Sign in with GitHub to configure projects, routes, policies, and connections in the dashboard UI.
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
      Provider credentials (OpenAI, Anthropic, etc.) are separate from Gateway keys. Keep them in your env or secret manager, use a vault
      <strong>reference</strong> in Connections, or (when encryption is enabled on this deployment) store a <strong>hosted API key</strong>
      encrypted at rest for flows like Restormel Testing resolve. See Provider access modes for the decision tree.
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
    border: var(--border-thin);
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
    border: var(--border-thin);
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
    border: var(--border-thin);
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
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.45;
  }
  .cli-hint a {
    color: var(--rm-sage);
    font-weight: 500;
  }
  /* localStorage migration offer (W3.7/K1) */
  .migration-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    margin: 0 0 var(--space-3);
    background: var(--rm-surface-raised);
    border: var(--border-thin);
    border-left: 4px solid var(--rm-accent, #f5c518);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .migration-text {
    flex: 1 1 auto;
  }
  .migration-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .new-key-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .new-key-box {
    background: var(--rm-surface-raised);
    border: var(--border-thin);
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
    border: var(--border-thin);
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
  .btn-sm {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
  }
  .btn-primary {
    background: var(--rm-accent, #111);
    color: var(--rm-on-accent, #fff);
  }
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: var(--border-thin);
  }
  .btn-danger {
    background: transparent;
    color: var(--rm-muted);
    border: var(--border-thin);
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
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: var(--border-thin);
  }
  .key-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    flex: 1 1 auto;
    min-width: 0;
  }
  .key-prefix {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    flex-shrink: 0;
  }
  .key-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--rm-text);
    flex-shrink: 0;
  }
  .key-label-absent {
    color: var(--rm-dim);
    font-style: italic;
    font-weight: 400;
  }
  .key-project {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  /* Metadata: created + last used (W3.7/K1) */
  .key-times {
    display: flex;
    gap: var(--space-4);
    flex-shrink: 0;
  }
  .key-time-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .key-time-label {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .key-time-value {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
  }
  /* Inline rename (W3.7/K1) */
  .rename-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    flex: 1 1 auto;
  }
  .rename-input {
    padding: var(--space-1) var(--space-2);
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
    flex: 1 1 12rem;
    min-width: 8rem;
    max-width: 24rem;
  }
  .rename-error {
    font-size: var(--text-xs);
    color: var(--coral-alert);
  }
  .key-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .btn-icon {
    padding: var(--space-1) var(--space-2);
    border: var(--border-thin);
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
