<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import {
    ciStagingSecretsSnippet,
    restormelControlPlaneBaseUrl,
    restormelEvaluatePolicyUrl,
  } from "$lib/env-snippet";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  export let data: {
    project: { id: string; name: string } | null;
    keys: { id: string; keyPrefix: string }[];
    environments: { id: string; name: string; type: string }[];
    keysBaseUrl: string;
    error?: string | null;
  };

  let copiedId: string | null = null;
  let editingName = "";
  let renaming = false;
  let deleting = false;
  let actionError = "";
  let selectedCiEnvId = "";
  let freshGatewayKey: string | null = null;
  let snippetKeyPaste = "";
  let creatingKey = false;
  let createKeyError = "";
  let copiedFullSnippet = false;

  $: editingName = data.project?.name ?? "";

  $: {
    const envs = data.environments ?? [];
    if (envs.length === 0) {
      selectedCiEnvId = "";
    } else if (!selectedCiEnvId || !envs.some((e) => e.id === selectedCiEnvId)) {
      const dev = envs.find((e) => e.type?.toLowerCase() === "development");
      selectedCiEnvId = dev?.id ?? envs[0].id;
    }
  }

  function effectiveGatewayKeyForSnippet(): string | undefined {
    const pasted = snippetKeyPaste.trim();
    if (freshGatewayKey) return freshGatewayKey;
    if (pasted.length > 0) return pasted;
    return undefined;
  }

  function buildCiSnippet(): string {
    if (!data.project) return "";
    const env = data.environments.find((e) => e.id === selectedCiEnvId);
    const environmentsOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).environments;
    return ciStagingSecretsSnippet({
      gatewayKey: effectiveGatewayKeyForSnippet(),
      projectId: data.project.id,
      environmentId: env?.id,
      environmentLabel: env ? `${env.name} (${env.type})` : undefined,
      keysBaseUrl: data.keysBaseUrl,
      includeEnvironmentId: environmentsOn,
    });
  }

  async function copyFullCiSnippet() {
    try {
      await navigator.clipboard.writeText(buildCiSnippet());
      copiedFullSnippet = true;
      setTimeout(() => (copiedFullSnippet = false), 2500);
    } catch {
      // clipboard unavailable
    }
  }

  async function createGatewayKeyForProject() {
    if (!data.project) return;
    creatingKey = true;
    createKeyError = "";
    freshGatewayKey = null;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${data.project.id}/keys`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data?.rawKey) {
        freshGatewayKey = body.data.rawKey as string;
        snippetKeyPaste = "";
        await invalidateAll();
      } else {
        createKeyError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      createKeyError = e instanceof Error ? e.message : "Request failed";
    } finally {
      creatingKey = false;
    }
  }

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

  <section class="section">
    <h2 class="section-title">Environments</h2>
    <p class="section-desc">
      Development and Production are separate <strong>slots</strong> for routes and policy. Your Gateway key is <strong>project-wide</strong> — it
      does not change per environment. For CI, pick <strong>one</strong> environment ID (usually Development) in the Copy for CI section below.
    </p>
    {#if data.environments?.length > 0}
      <ul class="env-list">
        {#each data.environments as env}
          <li class="env-row">
            <span class="env-name">{env.name}</span>
            <span class="env-type">{env.type}</span>
            <code class="env-id">{env.id}</code>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="env-empty">No environments on this project yet. You can still copy project ID and create a key; add environments when you split dev/prod routing.</p>
    {/if}
  </section>

  <section class="section section-gateway" aria-labelledby="gateway-project-heading">
    <h2 id="gateway-project-heading" class="section-title">Gateway keys (this project)</h2>
    <p class="section-desc">
      Create a key here so you can copy a <strong>complete CI snippet</strong> in the next section without jumping to Access. Full keys are shown
      <strong>once</strong> after creation — same as Access. Revoke or label keys anytime in
      <a href={DASHBOARD_BASE + "/access"}>Gateway keys</a>.
    </p>
    {#if createKeyError}
      <p class="error" role="alert">{createKeyError}</p>
    {/if}
    {#if freshGatewayKey}
      <div class="fresh-key-banner" role="status" aria-live="polite">
        <p class="fresh-key-title">New key — copy into your snippet now</p>
        <p class="fresh-key-warning">We will not show this full key again. Use “Copy full CI snippet” below, or copy the key alone.</p>
        <code class="fresh-key-value">{freshGatewayKey}</code>
        <button type="button" class="btn btn-secondary btn-sm" onclick={() => copyToClipboard(freshGatewayKey!, "fresh-raw")}>
          {copiedId === "fresh-raw" ? "Copied" : "Copy key only"}
        </button>
      </div>
    {/if}
    <form
      class="create-key-inline"
      onsubmit={(e) => {
        e.preventDefault();
        createGatewayKeyForProject();
      }}
    >
      <button type="submit" class="btn btn-primary" disabled={creatingKey}>
        {creatingKey ? "Creating…" : "Create Gateway key for this project"}
      </button>
    </form>
    {#if data.keys.length > 0}
      <p class="key-count">
        {data.keys.length} key{data.keys.length === 1 ? "" : "s"} on this project (prefixes only):
        {#each data.keys as k, i}
          <code class="inline-code">{k.keyPrefix}</code>{#if i < data.keys.length - 1}, {/if}
        {/each}
      </p>
    {/if}
  </section>

  <section id="ci-secrets" class="section section-ci-secrets" aria-labelledby="ci-secrets-heading">
    <h2 id="ci-secrets-heading" class="section-title">Copy for CI (GitHub Secrets)</h2>
    <p class="section-desc">
      After a Gateway key exists (create above or in Access), copy <strong>everything at once</strong> for your repo’s
      <strong>Settings → Secrets and variables → Actions</strong>. Use a non-production project for CI unless you accept that risk.
      <code class="inline-code">*_STAGING</code> names match our docs; workflows map them to <code class="inline-code">RESTORMEL_*</code>.
      Includes <strong>policy evaluate</strong> (<code class="inline-code">RESTORMEL_EVALUATE_URL</code>), <strong>control-plane base</strong>
      (<code class="inline-code">RESTORMEL_CONTROL_PLANE_URL</code>), and <strong>server token</strong> (<code class="inline-code">RESTORMEL_SERVER_TOKEN</code>
      — same value as the Gateway key for MCP / Plot-style admin wizards). The full snippet also repeats <strong>unprefixed</strong> names for setup
      wizards that expect <code class="inline-code">RESTORMEL_PROJECT_ID</code> / <code class="inline-code">RESTORMEL_ENVIRONMENT_ID</code> without
      <code class="inline-code">_STAGING</code>.
    </p>

    {#if data.environments?.length > 0}
      <div class="ci-env-pick">
        <label for="ci-env-select" class="ci-env-label">Environment ID for this snippet (CI usually targets Development)</label>
        <select id="ci-env-select" bind:value={selectedCiEnvId} class="ci-env-select">
          {#each data.environments as env}
            <option value={env.id}>{env.name} ({env.type})</option>
          {/each}
        </select>
      </div>
    {/if}

    <div class="ci-snippet-actions">
      <button type="button" class="btn btn-primary" onclick={copyFullCiSnippet}>
        {copiedFullSnippet ? "Copied full snippet" : "Copy full CI snippet (.env format)"}
      </button>
    </div>

    {#if !freshGatewayKey && data.keys.length > 0}
      <div class="ci-paste-key">
        <label for="snippet-key-paste" class="ci-paste-label">Optional: paste a Gateway key to include in the snippet</label>
        <p class="ci-paste-hint">
          Not saved on our servers — only used in this tab to build the copy block. Use if you already created a key elsewhere.
        </p>
        <input
          id="snippet-key-paste"
          bind:value={snippetKeyPaste}
          type="password"
          autocomplete="off"
          class="ci-paste-input"
          placeholder="rk_live_…"
        />
      </div>
    {/if}

    <p class="ci-row-hint">Or copy individual values:</p>
    <ul class="ci-secrets-list">
      <li class="ci-secret-row">
        <div class="ci-secret-meta">
          <code class="ci-secret-name">RESTORMEL_GATEWAY_KEY_STAGING</code>
          <span class="ci-secret-desc">Project-wide Gateway key (same key for every environment slot)</span>
        </div>
        <div class="ci-secret-value">
          {#if freshGatewayKey}
            <code class="ci-secret-display ci-secret-display--raw">{freshGatewayKey}</code>
            <button type="button" class="btn btn-secondary btn-sm" onclick={() => copyToClipboard(freshGatewayKey!, "gw-row")}>
              {copiedId === "gw-row" ? "Copied" : "Copy"}
            </button>
          {:else}
            <span class="ci-secret-masked">Create a key above, paste in the optional field, or use Access.</span>
            <a href={DASHBOARD_BASE + "/access"} class="btn btn-secondary btn-sm">Open Access</a>
          {/if}
        </div>
      </li>
      <li class="ci-secret-row">
        <div class="ci-secret-meta">
          <code class="ci-secret-name">RESTORMEL_SERVER_TOKEN_STAGING</code>
          <span class="ci-secret-desc"
            >MCP control-plane + Plot wizard “server token”: <strong>same Bearer</strong> as the Gateway key unless you use a separate token.</span
          >
        </div>
        <div class="ci-secret-value">
          {#if freshGatewayKey}
            <code class="ci-secret-display ci-secret-display--raw">{freshGatewayKey}</code>
            <button type="button" class="btn btn-secondary btn-sm" onclick={() => copyToClipboard(freshGatewayKey!, "srv-row")}>
              {copiedId === "srv-row" ? "Copied" : "Copy"}
            </button>
          {:else if snippetKeyPaste.trim()}
            <code class="ci-secret-display ci-secret-display--raw">{snippetKeyPaste.trim()}</code>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              onclick={() => copyToClipboard(snippetKeyPaste.trim(), "srv-paste")}
            >
              {copiedId === "srv-paste" ? "Copied" : "Copy"}
            </button>
          {:else}
            <span class="ci-secret-masked">Same as Gateway key — create or paste key above.</span>
          {/if}
        </div>
      </li>
      <li class="ci-secret-row">
        <div class="ci-secret-meta">
          <code class="ci-secret-name">RESTORMEL_PROJECT_ID_STAGING</code>
          <span class="ci-secret-desc">This project’s ID</span>
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
          <span class="ci-secret-desc">One environment per CI pipeline — choose Development or Production above, then copy that ID here</span>
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
            <span class="ci-secret-muted">No environments yet.</span>
          {/if}
        </div>
      </li>
      <li class="ci-secret-row ci-secret-optional">
        <div class="ci-secret-meta">
          <code class="ci-secret-name">RESTORMEL_KEYS_BASE_STAGING</code>
          <span class="ci-secret-desc">Site origin (change if self-hosted)</span>
        </div>
        <div class="ci-secret-value">
          <code class="ci-secret-display">{data.keysBaseUrl}</code>
          <button type="button" class="btn btn-secondary btn-sm" onclick={() => copyToClipboard(data.keysBaseUrl, "base")}>
            {copiedId === "base" ? "Copied" : "Copy"}
          </button>
        </div>
      </li>
      <li class="ci-secret-row">
        <div class="ci-secret-meta">
          <code class="ci-secret-name">RESTORMEL_EVALUATE_URL_STAGING</code>
          <span class="ci-secret-desc"
            >Full URL for <code class="inline-code">POST …/policies/evaluate</code> (Bearer = Gateway key). Map to
            <code class="inline-code">RESTORMEL_EVALUATE_URL</code> in your app.</span
          >
        </div>
        <div class="ci-secret-value">
          <code class="ci-secret-display">{restormelEvaluatePolicyUrl(data.keysBaseUrl)}</code>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick={() => copyToClipboard(restormelEvaluatePolicyUrl(data.keysBaseUrl), "eval")}
          >
            {copiedId === "eval" ? "Copied" : "Copy"}
          </button>
        </div>
      </li>
      <li class="ci-secret-row ci-secret-optional">
        <div class="ci-secret-meta">
          <code class="ci-secret-name">RESTORMEL_CONTROL_PLANE_URL_STAGING</code>
          <span class="ci-secret-desc"
            >Dashboard base for MCP <code class="inline-code">routes.*</code> / <code class="inline-code">policies.*</code> — not the same as the
            evaluate URL above.</span
          >
        </div>
        <div class="ci-secret-value">
          <code class="ci-secret-display">{restormelControlPlaneBaseUrl(data.keysBaseUrl)}</code>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick={() => copyToClipboard(restormelControlPlaneBaseUrl(data.keysBaseUrl), "cp")}
          >
            {copiedId === "cp" ? "Copied" : "Copy"}
          </button>
        </div>
      </li>
    </ul>
  </section>

  <p class="project-quick-links">
    <a href={DASHBOARD_BASE + "/analytics"}>Usage &amp; analytics</a>
    ·
    <a href={DASHBOARD_BASE + "/projects/" + data.project.id + "/usage"}>Project usage</a>
  </p>
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
  .project-quick-links {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: var(--space-4) 0 0;
  }
  .project-quick-links a {
    color: var(--rm-sage);
    text-decoration: underline;
    text-underline-offset: 2px;
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
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
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
  .env-id {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    color: var(--rm-dim);
    word-break: break-all;
  }
  .env-empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.45;
  }
  .inline-code {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: 0.85em;
    padding: 0.1em 0.3em;
    background: var(--rm-bg);
    border-radius: 4px;
    border: 1px solid var(--rm-border);
  }
  .section-gateway {
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
  }
  .fresh-key-banner {
    margin-bottom: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--rm-radius);
    border: 1px solid color-mix(in oklab, var(--rm-sage) 40%, var(--rm-border));
    background: color-mix(in oklab, var(--rm-sage) 8%, var(--rm-surface));
  }
  .fresh-key-title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
  }
  .fresh-key-warning {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    color: var(--coral-alert);
  }
  .fresh-key-value {
    display: block;
    margin-bottom: var(--space-2);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    word-break: break-all;
    color: var(--rm-text);
  }
  .create-key-inline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .key-count {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.5;
  }
  .ci-env-pick {
    margin-bottom: var(--space-3);
  }
  .ci-env-label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
    margin-bottom: var(--space-1);
  }
  .ci-env-select {
    max-width: 24rem;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .ci-snippet-actions {
    margin-bottom: var(--space-3);
  }
  .ci-paste-key {
    margin-bottom: var(--space-4);
    padding: var(--space-3);
    border: 1px dashed var(--rm-border);
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, var(--rm-surface-raised) 80%, transparent);
  }
  .ci-paste-label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
    margin-bottom: var(--space-1);
  }
  .ci-paste-hint {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    color: var(--rm-muted);
    line-height: 1.45;
  }
  .ci-paste-input {
    width: 100%;
    max-width: 28rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-text);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-sm);
  }
  .ci-row-hint {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .ci-secret-display--raw {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    max-width: 100%;
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
