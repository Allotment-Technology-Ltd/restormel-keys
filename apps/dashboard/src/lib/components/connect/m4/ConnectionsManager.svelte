<script lang="ts">
  /**
   * M4 connections manager (RES-113 PR-E; designs/M4 Connections.html).
   *
   * One area, many connection shapes. First connection → the wizard; after that →
   * a manager listing each connection (type icon, access badge, endpoint, status,
   * delete danger-zone). THE KEY IS THE CONNECTION: each connection is a real
   * Gateway key minted through the EXISTING key CRUD (api/projects/[id]/keys) — no
   * auth-model or schema change here (that is PR-L). Method/access are a
   * presentational MOCK; the read+write badge does not enforce anything yet.
   *
   * Consumes the M0–M4 milestone helper (connect-journey) for the "where am I /
   * what next" cue: M4 is the terminal milestone.
   */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { buildConnectMcpSnippet } from "$lib/connect/connect-mcp-snippet";
  import { MILESTONE_LABEL } from "$lib/connect/connect-journey";
  import StateChip from "$lib/components/brutalist/StateChip.svelte";
  import type { ConnectAgentSetupData } from "$lib/connect/agent-setup-types";
  import ConnectWizard from "./ConnectWizard.svelte";
  import ConnectionRow from "./ConnectionRow.svelte";
  import {
    connectionFromKey,
    getMethod,
    MOCK_SCOPE_NOTE,
    ENFORCED_SCOPE_NOTE,
    type ConnectionView,
    type ConnectionMethodId,
    type ConnectionAccessId,
  } from "./connection-model";

  export let setup: ConnectAgentSetupData;
  /**
   * RES-113 PR-L — when true (onboardingJourney flag ON), the key IS the connection: new keys are
   * minted purpose-bound (type + access + target) and the access badge reflects a REAL enforced
   * scope. When false, behaviour is the PR-E presentational shell (mock scope, flat keys).
   */
  export let enforceScope = false;

  // Connections derived from the workspace's stored Gateway keys (the manager view). When scope is
  // enforced, the key's persisted key_type/access drive the view; otherwise they derive from label.
  let serverConnections: ConnectionView[] = setup.gatewayKeys.map((k) =>
    connectionFromKey({
      id: k.id,
      keyPrefix: k.keyPrefix,
      label: k.label,
      projectId: k.projectId,
      keyType: k.keyType ?? null,
      access: k.access ?? null,
    }),
  );
  // Connections minted in this session (authoritative for the chosen method/access).
  let sessionConnections: ConnectionView[] = [];

  $: connections = [...sessionConnections, ...serverConnections];
  $: hasConnections = connections.length > 0;

  // Wizard is shown automatically when there are no connections yet (first run),
  // and on demand via "New connection".
  let wizardOpen = false;
  $: showWizard = wizardOpen || !hasConnections;

  let projectId = setup.defaultProjectId ?? setup.projects[0]?.id ?? "";
  $: hasProject = Boolean(projectId);

  let creating = false;
  let createError = "";
  let deletingKeyId: string | null = null;

  // The just-created key — shown once, with a copy-ready snippet for MCP connections.
  let newKey: { raw: string; method: ConnectionMethodId; name: string } | null = null;
  let copiedKey = false;
  let copiedSnippet = false;

  $: newKeySnippet =
    newKey && newKey.method === "mcp"
      ? buildConnectMcpSnippet({
          connectApiBase: setup.connectApiBase,
          workspaceId: setup.workspaceId,
          gatewayKey: newKey.raw,
          projectId,
        })
      : "";

  function openWizard() {
    createError = "";
    newKey = null;
    wizardOpen = true;
  }

  function closeWizard() {
    // Only collapsible when at least one connection already exists.
    if (hasConnections) wizardOpen = false;
  }

  async function handleCreate(
    e: CustomEvent<{ method: ConnectionMethodId; access: ConnectionAccessId; name: string }>,
  ) {
    if (!projectId) {
      createError = "Create a Keys project before adding a connection.";
      return;
    }
    const { method, access, name } = e.detail;
    creating = true;
    createError = "";
    try {
      // PR-L: mint the key purpose-bound. When enforceScope is OFF the server ignores keyType/access
      // (flat key); when ON it persists + enforces them ("the key IS the connection"). The target is
      // the graph/workspace this connection serves.
      const payload: Record<string, unknown> = enforceScope
        ? { label: name, keyType: method, access, target: setup.workspaceId }
        : { label: name };
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${projectId}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data?.rawKey) {
        const keyId = typeof body.data.keyId === "string" ? body.data.keyId : "";
        const keyPrefix = typeof body.data.keyPrefix === "string" ? body.data.keyPrefix : "rk_…";
        // Session-authoritative view: show exactly the chosen method/access. When scope is enforced
        // the badge is real (isMockScope false); otherwise it is a presentational label.
        sessionConnections = [
          {
            keyId,
            keyPrefix,
            name,
            method,
            access,
            projectId,
            isMockScope: !enforceScope,
          },
          ...sessionConnections,
        ];
        newKey = { raw: body.data.rawKey, method, name };
        wizardOpen = false;
      } else {
        createError = (body as { error?: string }).error ?? `Request failed (${res.status})`;
      }
    } catch (err) {
      createError = err instanceof Error ? err.message : "Request failed";
    } finally {
      creating = false;
    }
  }

  async function handleDelete(e: CustomEvent<{ keyId: string }>) {
    const { keyId } = e.detail;
    // Find the owning project for the delete route (server keys carry their own project).
    const conn = connections.find((c) => c.keyId === keyId);
    const pid = conn?.projectId || projectId;
    if (!pid) return;
    deletingKeyId = keyId;
    try {
      const res = await fetch(`${DASHBOARD_BASE}/api/projects/${pid}/keys`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keyId }),
      });
      if (res.ok) {
        sessionConnections = sessionConnections.filter((c) => c.keyId !== keyId);
        serverConnections = serverConnections.filter((c) => c.keyId !== keyId);
        if (newKey && conn && newKey.name === conn.name) newKey = null;
      }
    } finally {
      deletingKeyId = null;
    }
  }

  async function copyNewKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.raw);
      copiedKey = true;
      setTimeout(() => (copiedKey = false), 2000);
    } catch {
      copiedKey = false;
    }
  }
  async function copyNewSnippet() {
    if (!newKeySnippet) return;
    try {
      await navigator.clipboard.writeText(newKeySnippet);
      copiedSnippet = true;
      setTimeout(() => (copiedSnippet = false), 2000);
    } catch {
      copiedSnippet = false;
    }
  }
</script>

<section class="manager" aria-labelledby="m4-manager-heading">
  <!-- where am I / what next cue (consumes the M0–M4 milestone helper) -->
  <div class="cue">
    <StateChip state={hasConnections ? "done" : "running"} label={`M4 · ${MILESTONE_LABEL.m4}`} />
    <span class="cue-text">
      {#if hasConnections}
        Live — your app, agent, or site can answer from your graph, with citations.
      {:else}
        Create your first connection to let your app reach your graph.
      {/if}
    </span>
  </div>

  {#if setup.projects.length === 0}
    <p class="blocked" role="status">
      <a href={DASHBOARD_BASE + "/projects"}>Create a Keys project</a> before adding a connection.
    </p>
  {/if}

  {#if hasConnections}
    <header class="mgr-head">
      <div>
        <h2 id="m4-manager-heading">Connections</h2>
        <p class="sub">Everything connected to your graph. Add any number, of any type.</p>
      </div>
      {#if !showWizard}
        <button type="button" class="btn btn-primary new-btn" on:click={openWizard} disabled={!hasProject}>
          + New connection
        </button>
      {/if}
    </header>
  {/if}

  {#if newKey}
    <div class="new-key" role="status" aria-live="polite">
      <p class="nk-label">New connection key — copy now (shown once):</p>
      <code class="nk-value">{newKey.raw}</code>
      <div class="nk-actions">
        <button type="button" class="btn btn-secondary" on:click={copyNewKey}>
          {copiedKey ? "Copied key" : "Copy key"}
        </button>
      </div>
      {#if newKeySnippet}
        <p class="nk-sub">Add to your agent's MCP host config:</p>
        <pre class="snippet" aria-label="MCP config snippet"><code>{newKeySnippet}</code></pre>
        <button type="button" class="btn btn-secondary" on:click={copyNewSnippet}>
          {copiedSnippet ? "Copied snippet" : "Copy MCP snippet"}
        </button>
      {:else if newKey.method === "rest"}
        <p class="nk-sub">
          Send it as <code>Authorization: Bearer {newKey.raw.slice(0, 10)}…</code> to the REST endpoint.
        </p>
      {/if}
    </div>
  {/if}

  {#if showWizard}
    {#if setup.projects.length > 1}
      <label class="proj-field">
        <span class="field-label">Project for this connection</span>
        <select class="input" bind:value={projectId} disabled={creating}>
          {#each setup.projects as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </label>
    {/if}
    <ConnectWizard
      connectApiBase={setup.connectApiBase}
      {creating}
      {createError}
      on:create={handleCreate}
      on:cancel={closeWizard}
    />
  {/if}

  {#if hasConnections}
    <ul class="conn-list">
      {#each connections as conn (conn.keyId)}
        <ConnectionRow
          connection={conn}
          connectApiBase={setup.connectApiBase}
          deleting={deletingKeyId === conn.keyId}
          on:delete={handleDelete}
        />
      {/each}
    </ul>
    <p class="mock-note" role="note">{enforceScope ? ENFORCED_SCOPE_NOTE : MOCK_SCOPE_NOTE}</p>
    <p class="manage-link">
      <a href={DASHBOARD_BASE + "/access"}>Manage and revoke Gateway keys</a>
    </p>
  {/if}
</section>

<style>
  .manager {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .cue {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    border: 2px solid var(--color-ink);
    border-left: 8px solid var(--signal-teal);
    background: color-mix(in srgb, var(--signal-teal) 9%, var(--color-surface));
    padding: var(--space-3);
  }
  .cue-text {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--color-ink);
  }
  .mgr-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .mgr-head h2 {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: -0.01em;
    line-height: 0.95;
    margin: 0;
    font-size: 1.9rem;
  }
  .sub {
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }
  .new-btn {
    white-space: nowrap;
  }
  .conn-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .blocked {
    font-size: var(--text-sm);
    padding: var(--space-3);
    border: var(--border-thin);
  }
  .proj-field {
    display: block;
  }
  .field-label {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: var(--space-2);
    color: var(--color-ink-muted);
  }
  .new-key {
    padding: var(--space-3);
    border: 2px solid var(--color-ink);
    background: color-mix(in srgb, var(--color-yellow) 12%, var(--color-surface));
  }
  .nk-label {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 700;
  }
  .nk-value {
    display: block;
    word-break: break-all;
    font-size: 0.85rem;
    padding: var(--space-2);
    background: var(--color-bg);
    border: var(--border-thin);
  }
  .nk-actions {
    margin-top: var(--space-2);
  }
  .nk-sub {
    margin: var(--space-3) 0 var(--space-2);
    font-size: var(--text-sm);
  }
  .snippet {
    overflow-x: auto;
    font-size: 0.8rem;
    padding: var(--space-3);
    border: var(--border-thin);
    background: var(--color-bg);
    margin: 0 0 var(--space-2);
  }
  .mock-note {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    line-height: 1.5;
    margin: 0;
  }
  .manage-link {
    font-size: var(--text-sm);
    margin: 0;
  }
</style>
