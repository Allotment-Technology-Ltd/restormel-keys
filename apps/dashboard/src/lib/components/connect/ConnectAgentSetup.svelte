<script lang="ts">
  import { onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";
  import { buildConnectMcpSnippet } from "$lib/connect/connect-mcp-snippet";
  import type { ConnectAgentSetupData, ConnectAgentGatewayKey } from "$lib/connect/agent-setup-types";
  import {
    consumePendingGatewayKeySession,
    isGatewayKeyShape,
    savePendingGatewayKeySession,
  } from "$lib/connect/connect-gateway-key-storage";

  /** When true, omit outer card chrome (pipeline wizard tab). */
  export let embedded = false;

  export let setup: ConnectAgentSetupData;

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";
  const GATEWAY_PLACEHOLDER = "<your-rk-gateway-key>";

  let creating = false;
  let createError = "";
  let createLabel = "";
  let createProjectId = setup.defaultProjectId ?? setup.projects[0]?.id ?? "";
  let newKeyRaw: string | null = null;
  let newKeyProjectId: string | null = null;
  let copiedSnippet = false;
  let copiedKey = false;
  let keyLabels: Record<string, string> = {};
  let showCreateForm = false;
  let localKeys: ConnectAgentGatewayKey[] = [];

  function loadKeyLabels() {
    if (typeof localStorage === "undefined") return;
    try {
      keyLabels = JSON.parse(localStorage.getItem("rk_key_labels") ?? "{}") as Record<string, string>;
    } catch {
      keyLabels = {};
    }
  }

  function keyLabel(key: ConnectAgentGatewayKey): string {
    return keyLabels[key.keyPrefix] ?? key.projectName;
  }

  $: allGatewayKeys = [...setup.gatewayKeys, ...localKeys];
  $: hasRegisteredKeys = allGatewayKeys.length > 0;

  $: createProjectId =
    setup.defaultProjectId && setup.projects.some((p) => p.id === setup.defaultProjectId)
      ? setup.defaultProjectId
      : createProjectId || setup.projects[0]?.id || "";

  $: snippetProjectId =
    newKeyProjectId ??
    setup.projectId ??
    allGatewayKeys[0]?.projectId ??
    createProjectId ??
    null;

  $: gatewayKeyForSnippet = newKeyRaw ?? GATEWAY_PLACEHOLDER;
  $: snippetReady = Boolean(newKeyRaw && isGatewayKeyShape(newKeyRaw));
  $: mcpSnippet = buildConnectMcpSnippet({
    connectApiBase: setup.connectApiBase,
    workspaceId: setup.workspaceId,
    gatewayKey: gatewayKeyForSnippet,
    projectId: snippetProjectId,
  });

  onMount(() => {
    loadKeyLabels();
    const pending = consumePendingGatewayKeySession();
    if (pending) {
      newKeyRaw = pending.rawKey;
      newKeyProjectId = pending.projectId;
      localKeys = [
        ...localKeys.filter((k) => k.id !== pending.keyId),
        {
          id: pending.keyId,
          keyPrefix: pending.keyPrefix,
          projectId: pending.projectId,
          projectName:
            setup.projects.find((p) => p.id === pending.projectId)?.name ??
            setup.gatewayKeys.find((k) => k.id === pending.keyId)?.projectName ??
            "Project",
        },
      ];
    }
    showCreateForm =
      setup.projects.length > 0 && setup.gatewayKeys.length === 0 && localKeys.length === 0;
  });

  async function createGatewayKey() {
    if (!createProjectId) return;
    creating = true;
    createError = "";
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${createProjectId}/keys`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data?.rawKey) {
        newKeyRaw = body.data.rawKey;
        newKeyProjectId = createProjectId;
        const keyId = typeof body.data.keyId === "string" ? body.data.keyId : "";
        const keyPrefix = typeof body.data.keyPrefix === "string" ? body.data.keyPrefix : "";
        const project = setup.projects.find((p) => p.id === createProjectId);
        if (keyId) {
          localKeys = [
            ...localKeys.filter((k) => k.id !== keyId),
            {
              id: keyId,
              keyPrefix,
              projectId: createProjectId,
              projectName: project?.name ?? "Project",
            },
          ];
          savePendingGatewayKeySession({
            keyId,
            rawKey: body.data.rawKey,
            keyPrefix,
            projectId: createProjectId,
            savedAt: Date.now(),
          });
        }
        if (createLabel.trim() && keyPrefix) {
          keyLabels[keyPrefix] = createLabel.trim();
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("rk_key_labels", JSON.stringify(keyLabels));
          }
        }
        createLabel = "";
        showCreateForm = false;
      } else {
        createError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (e) {
      createError = e instanceof Error ? e.message : "Request failed";
    } finally {
      creating = false;
    }
  }

  async function copySnippet() {
    if (!snippetReady) return;
    try {
      await navigator.clipboard.writeText(mcpSnippet);
      copiedSnippet = true;
      setTimeout(() => (copiedSnippet = false), 2000);
    } catch {
      copiedSnippet = false;
    }
  }

  function copyNewKey() {
    if (!newKeyRaw) return;
    navigator.clipboard.writeText(newKeyRaw);
    copiedKey = true;
    setTimeout(() => (copiedKey = false), 2000);
  }
</script>

<section class="agent-setup" class:agent-setup-embedded={embedded} aria-labelledby="agent-setup-heading">
  <h2 id="agent-setup-heading">Connect your agent</h2>
  {#if setup.surrealStoreReady}
    <p class="agent-lead">
      Your knowledge graph stays on <strong>your SurrealDB</strong>. Restormel runs ingest and retrieval against it —
      agents call <code>connect.search</code> via MCP with a Gateway key (<code>rk_…</code>).
    </p>
  {:else if setup.workspaceStoreReady}
    <p class="agent-lead">
      Your graph lives in your <strong>workspace database</strong>. Use REST retrieve and a Gateway key (<code>rk_…</code>)
      for agents today — MCP <code>connect.search</code> requires a Surreal graph store.
      <a href={pipelineWizardHref("store")}>Switch to Surreal</a> if you need MCP tools.
    </p>
  {:else}
    <p class="agent-lead">
      Connect a graph store, publish ingestion routes, and run ingest — then wire agents with a Gateway key
      (<code>rk_…</code>) via REST or MCP.
    </p>
  {/if}

  <section class="gateway-panel" aria-labelledby="gateway-key-heading">
    <h3 id="gateway-key-heading">Gateway key for MCP</h3>

    {#if setup.projects.length === 0}
      <p class="agent-blocked" role="status">
        <a href={DASHBOARD_BASE + "/projects"}>Create a Keys project</a> before issuing a Gateway key.
      </p>
    {:else}
      {#if hasRegisteredKeys}
        <div class="existing-keys" aria-labelledby="existing-keys-heading">
          <h4 id="existing-keys-heading" class="subheading">Keys on your account</h4>
          <ul class="key-list">
            {#each allGatewayKeys as key (key.id)}
              <li>
                <code>{key.keyPrefix}</code>
                <span class="key-meta">{keyLabel(key)}</span>
              </li>
            {/each}
          </ul>
        </div>

        <div class="mcp-status-callout" role="note">
          <p>
            <strong>Already wired MCP?</strong> Your agent (Cursor, Claude Desktop, CI, or another host) keeps using
            the <code>rk_…</code> you put in <code>mcp.json</code> or env — Restormel does not store that secret and
            cannot show it again here. That configuration stays valid until you
            <a href={DASHBOARD_BASE + "/access"}>revoke the key</a> on Gateway keys.
          </p>
          <p>
            <strong>Rotating or first-time setup?</strong> Create a new Gateway key below (shown once), then paste the
            updated snippet into whichever system runs <code>@restormel/mcp</code>.
          </p>
        </div>
      {:else}
        <p class="hint">No Gateway keys yet — create one below, copy it when shown, then update your MCP host config.</p>
      {/if}

      {#if newKeyRaw}
        <div class="new-key-box" role="status" aria-live="polite">
          <p class="new-key-label">New Gateway key — copy now (shown once):</p>
          <code class="new-key-value">{newKeyRaw}</code>
          <div class="new-key-actions">
            <button type="button" class="btn btn-secondary" on:click={copyNewKey}>
              {copiedKey ? "Copied key" : "Copy Gateway key"}
            </button>
          </div>
          <p class="new-key-next brut-muted">
            Update <code>RESTORMEL_GATEWAY_KEY</code> in your MCP host, or copy the filled snippet below.
          </p>
        </div>
      {/if}

      <div class="create-section">
        <button
          type="button"
          class="btn btn-secondary create-toggle"
          aria-expanded={showCreateForm}
          on:click={() => (showCreateForm = !showCreateForm)}
        >
          {showCreateForm ? "Hide create new key" : hasRegisteredKeys ? "Create replacement Gateway key" : "Create Gateway key"}
        </button>
        {#if showCreateForm}
          {#if createError}
            <p class="create-error" role="alert">{createError}</p>
          {/if}
          <form
            class="create-key-form"
            on:submit|preventDefault={createGatewayKey}
            aria-label="Create Gateway key"
          >
            <label for="agent-project-select" class="field-label">Project</label>
            <select id="agent-project-select" class="select" bind:value={createProjectId} disabled={creating}>
              {#each setup.projects as project (project.id)}
                <option value={project.id}>{project.name}</option>
              {/each}
            </select>
            <label for="agent-key-label" class="field-label">Label (optional)</label>
            <input
              id="agent-key-label"
              class="select"
              bind:value={createLabel}
              placeholder="e.g. Cursor MCP"
              disabled={creating}
            />
            <button type="submit" class="btn btn-primary" disabled={creating || !createProjectId}>
              {creating ? "Creating…" : "Create Gateway key"}
            </button>
          </form>
        {/if}
      </div>

      <p class="hint manage-keys">
        <a href={DASHBOARD_BASE + "/access"}>Manage and revoke Gateway keys</a>
      </p>
    {/if}
  </section>

  {#if !setup.agentReady && !(setup.workspaceStoreReady && setup.modelsReady && setup.hasGraph)}
    <p class="agent-blocked" role="status">
      Complete graph setup before agents can query your corpus:
      {#if !setup.surrealStoreReady && !setup.workspaceStoreReady}
        <a href={pipelineWizardHref("store")}>connect a graph store</a>
      {/if}
      {#if !setup.modelsReady}
        · <a href={CONNECT_BASE + "/models"}>publish chat + embedding ingestion routes</a>
      {/if}
      {#if !setup.hasGraph}
        · <a href={pipelineWizardHref("launch")}>run ingest</a>
        · <a href={CONNECT_BASE + "/graph"}>open graph explorer</a>
      {/if}
    </p>
  {:else if setup.workspaceStoreReady && setup.modelsReady && setup.hasGraph}
    <p class="agent-ready" role="status">
      Workspace graph ready — use REST retrieve with your Gateway key. MCP tools need a Surreal store.
    </p>
  {:else}
    <p class="agent-ready" role="status">Graph store OK · models ready · corpus ingested — safe to wire agents.</p>
  {/if}

  <ul class="checklist">
    <li class:done={setup.surrealStoreReady || setup.workspaceStoreReady}>
      Graph store {setup.graphTargetStatus ? `(${setup.graphTargetStatus})` : ""}
      {#if setup.workspaceStoreReady && !setup.surrealStoreReady}<span class="badge status-muted">workspace</span>{/if}
    </li>
    <li class:done={setup.modelsReady}>Keys embedding + chat routes</li>
    <li class:done={setup.hasGraph}>Ingested graph with units</li>
    <li class:done={hasRegisteredKeys}>Gateway key issued</li>
  </ul>

  <h3>MCP (<code>@restormel/mcp</code>)</h3>
  <p class="hint">
    Tools: <code>connect.search</code>, <code>connect.get_context_for</code>. HTTP mirror:
    <code>POST {DASHBOARD_BASE}/api/connect/invoke</code> (session or Gateway key).
  </p>
  {#if snippetReady}
    <p class="snippet-ready" role="status">Snippet below includes your new key — copy it into your MCP host config.</p>
  {:else if hasRegisteredKeys}
    <p class="snippet-warn" role="status">
      Template only — use the <code>rk_…</code> already in your MCP host, or create a replacement key above to fill this
      snippet.
    </p>
  {:else}
    <p class="snippet-warn" role="status">
      Create a Gateway key above to generate a copy-ready snippet with a real <code>rk_…</code> value.
    </p>
  {/if}
  <pre class="snippet" aria-label="Cursor mcp.json snippet"><code>{mcpSnippet}</code></pre>
  <button type="button" class="btn btn-secondary" on:click={copySnippet} disabled={!snippetReady}>
    {copiedSnippet ? "Copied" : "Copy MCP snippet"}
  </button>
  <p class="related">
    <a href="/keys/docs/integrations/mcp">MCP integration guide</a>
    ·
    <a href="/connect/docs">Connect REST reference</a>
    ·
    <a href={DASHBOARD_BASE + "/dev-tools"}>Developer tools</a>
  </p>
</section>

<style>
  .agent-setup {
    margin-top: var(--space-6);
    padding: var(--space-5);
    border: 2px solid var(--rm-border);
    background: var(--rm-surface);
  }
  .agent-setup-embedded {
    margin-top: 0;
    padding: 0;
    border: none;
    background: transparent;
  }
  .agent-setup h2 {
    margin-top: 0;
  }
  .agent-lead {
    color: var(--rm-muted);
    line-height: 1.55;
    max-width: 42rem;
  }
  .gateway-panel {
    margin: var(--space-5) 0;
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
  }
  .gateway-panel h3 {
    margin-top: 0;
  }
  .subheading {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rm-muted);
  }
  .field-label {
    display: block;
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.25rem;
    color: var(--rm-muted);
  }
  .mcp-status-callout {
    margin: var(--space-3) 0;
    padding: var(--space-3);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    font-size: var(--text-sm);
    line-height: 1.55;
    max-width: 42rem;
  }
  .mcp-status-callout p {
    margin: 0 0 var(--space-2);
  }
  .mcp-status-callout p:last-child {
    margin-bottom: 0;
  }
  .create-section {
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--rm-border);
  }
  .create-toggle {
    margin-bottom: var(--space-3);
  }
  .create-key-form {
    display: grid;
    gap: var(--space-3);
    max-width: 28rem;
    margin-top: var(--space-3);
  }
  .select {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--rm-border);
    font: inherit;
    background: var(--rm-surface);
  }
  .key-list {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }
  .key-list li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.75rem;
    padding: 0.35rem 0;
  }
  .key-meta {
    color: var(--rm-muted);
  }
  .manage-keys {
    margin: var(--space-3) 0 0;
  }
  .new-key-box {
    margin: var(--space-3) 0;
    padding: var(--space-3);
    border: 2px solid var(--rm-border);
    background: color-mix(in srgb, var(--rm-accent, #f4c430) 12%, var(--rm-surface));
  }
  .new-key-label {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 700;
  }
  .new-key-next {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
  }
  .new-key-value {
    display: block;
    word-break: break-all;
    font-size: 0.85rem;
    padding: var(--space-2);
    background: var(--rm-bg);
    border: 1px solid var(--rm-border);
  }
  .new-key-actions {
    margin-top: var(--space-2);
  }
  .create-error {
    color: var(--rm-danger, #b00);
    font-size: var(--text-sm);
    margin: var(--space-2) 0 0;
  }
  .agent-blocked,
  .agent-ready {
    font-size: var(--text-sm);
    padding: var(--space-3);
    border: 1px solid var(--rm-border);
  }
  .agent-ready {
    background: color-mix(in srgb, var(--rm-success, #0a0) 8%, transparent);
  }
  .checklist {
    list-style: none;
    padding: 0;
    margin: var(--space-4) 0;
  }
  .checklist li {
    padding: 0.25rem 0;
    color: var(--rm-muted);
  }
  .checklist li.done {
    color: var(--rm-text);
  }
  .checklist li.done::before {
    content: "✓ ";
    color: var(--rm-accent, currentColor);
  }
  .snippet {
    overflow-x: auto;
    font-size: 0.8rem;
    padding: var(--space-3);
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
  }
  .snippet-warn,
  .snippet-ready {
    font-size: var(--text-sm);
    margin: 0 0 var(--space-2);
    max-width: 42rem;
    line-height: 1.45;
  }
  .snippet-warn {
    color: var(--rm-muted);
  }
  .snippet-ready {
    color: var(--rm-text);
  }
  .hint,
  .related {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
</style>
