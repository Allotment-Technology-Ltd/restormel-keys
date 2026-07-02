<script lang="ts">
  /**
   * M4 Connect — the state-derived S0/S1/S2 surface (RES-113 PR-7; REC-ADR-018
   * + its 2026-07-01 wizard-collapse addendum; copy pack §4, strings verbatim).
   *
   * Flag-ON only: this component mounts exclusively under `onboardingJourney`
   * (agents/wiring/+page.svelte), so the flag-OFF path is byte-identical by
   * construction.
   *
   * Reveal predicates (ux-craft §2.1) — `resolveConnectSurface`:
   *   S0 (`!setup.hasGraph`)                      → locked state; NOTHING else renders.
   *   S1 (`hasGraph && connections === 0`)        → StateChip cue bar + guided fork.
   *   S2 (`connections >= 1`)                     → manager list (list-plus-nudge; no
   *                                                 yellow primary — a steady state
   *                                                 demands nothing).
   *   success (a key was just minted)             → display-once key + endpoint +
   *                                                 one CTA to Home's ask.
   *
   * THE KEY IS THE CONNECTION (addendum §4): keys are minted purpose-bound
   * (type + access + target) through the existing key CRUD. The first key is
   * ENFORCED read-only (addendum §2) — there is no access step. Project is
   * resolved silently (`defaultProjectId ?? projects[0]`, addendum §3); the
   * inline chip appears only when genuinely ambiguous. RES-154: keys are
   * workspace-available — no copy re-introduces per-project binding.
   *
   * `LIVE` honesty (REC-ADR-016): the per-row chip derives from REAL request-log
   * traffic attributed to each key (`liveKeyIds`, ingest excluded) — the PR-3
   * `hasAppTraffic24h` probe pattern resolved PER CONNECTION in the wiring
   * loader. Until/unless evidence arrives, nothing renders.
   */
  import { tick } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { BUILD_HREF, HOME_HREF } from "$lib/nav-config";
  import { MILESTONE_LABEL } from "$lib/connect/connect-journey";
  import StateChip from "$lib/components/brutalist/StateChip.svelte";
  import type { ConnectAgentSetupData } from "$lib/connect/agent-setup-types";
  import ConnectWizard from "./ConnectWizard.svelte";
  import ConnectionRow from "./ConnectionRow.svelte";
  import {
    connectionFromKey,
    connectionEndpoint,
    resolveConnectSurface,
    resolveConnectProject,
    showReadWriteSuggestion,
    type ConnectionView,
    type ConnectionMethodId,
    type ConnectionAccessId,
  } from "./connection-model";

  export let setup: ConnectAgentSetupData;
  /**
   * When true (onboardingJourney ON — always true where this mounts), keys are
   * minted purpose-bound (type + access + target) and badges reflect REAL
   * enforced scope (PR-L). Kept as a prop so tests can pin both payload shapes.
   */
  export let enforceScope = false;
  /**
   * Key ids with REAL observed non-ingest traffic in the last 24h (the wiring
   * loader's per-connection honesty probe). Null while unresolved — rows render
   * without a `LIVE` chip until evidence arrives (absence, never fabrication).
   */
  export let liveKeyIds: Promise<string[]> | string[] | null = null;

  // Connections derived from the workspace's stored Gateway keys.
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

  // Silent project resolution (addendum §3).
  const resolvedProject = resolveConnectProject(setup);
  let projectId: string | null = resolvedProject.projectId;
  const projectAmbiguous = resolvedProject.ambiguous;

  // Per-key traffic evidence (resolves after mount; rows stay chip-less until then).
  let liveIds: string[] = [];
  $: if (liveKeyIds) {
    if (Array.isArray(liveKeyIds)) {
      liveIds = liveKeyIds;
    } else {
      liveKeyIds.then((ids) => (liveIds = ids)).catch(() => {});
    }
  }

  let creating = false;
  let createError = "";
  let deletingKeyId: string | null = null;

  // The just-created key — the display-once success screen (copy pack §4.3).
  let newKey: {
    raw: string;
    method: ConnectionMethodId;
    name: string;
  } | null = null;
  let copiedKey = false;
  let copiedEndpoint = false;

  // S2 add-form state. Opened by "+ Add connection" (read) or the read+write
  // suggestion row (read_write).
  let addFormOpen = false;
  let addFormAccess: ConnectionAccessId = "read";

  $: surface = resolveConnectSurface({
    hasGraph: setup.hasGraph,
    connectionCount: connections.length,
  });

  $: newKeyEndpoint = newKey
    ? connectionEndpoint({ connectApiBase: setup.connectApiBase, method: newKey.method })
    : "";

  // Persistent polite live region text (rendered empty at boot, outside every
  // {#if} — a11y skill: recreated regions don't announce).
  let announceText = "";
  function announce(text: string) {
    announceText = "";
    // Re-inject atomically so repeat announcements re-fire.
    void tick().then(() => (announceText = text));
  }

  async function openAddForm(access: ConnectionAccessId) {
    createError = "";
    addFormAccess = access;
    const wasOpen = addFormOpen;
    addFormOpen = true;
    await tick();
    if (!wasOpen) {
      (document.getElementById("m4-fork-heading") as HTMLElement | null)?.focus();
    }
  }

  async function closeAddForm(returnFocusId: string) {
    addFormOpen = false;
    await tick();
    document.getElementById(returnFocusId)?.focus();
  }

  function toggleAddForm() {
    if (addFormOpen) void closeAddForm("m4-add-connection");
    else void openAddForm("read");
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
      // Mint the key purpose-bound (addendum §4). enforceScope OFF ⇒ the server
      // ignores keyType/access (flat key); ON ⇒ persists + enforces them. The
      // target is the workspace this connection serves (RES-154: workspace-
      // available, never per-project bound).
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
        addFormOpen = false;
        // The fork is replaced by the success screen — relocate focus to its
        // heading (a11y skill: focus relocation on {#if} swaps).
        await tick();
        (document.getElementById("m4-success-heading") as HTMLElement | null)?.focus();
      } else {
        createError =
          (body as { error?: string }).error ??
          "We couldn't create the connection — something failed on our side. Try again in a moment.";
      }
    } catch {
      createError =
        "We couldn't create the connection — something failed on our side. Try again in a moment.";
    } finally {
      creating = false;
    }
  }

  async function handleDelete(e: CustomEvent<{ keyId: string }>) {
    const { keyId } = e.detail;
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
        announce("Connection deleted.");
        // The focused confirm button went with the row — relocate to the
        // surface heading (a11y skill: never drop focus to <body>).
        await tick();
        (document.getElementById("m4-connect-heading") as HTMLElement | null)?.focus();
      } else {
        announce("We couldn't delete the connection. Try again.");
      }
    } catch {
      announce("We couldn't delete the connection. Try again.");
    } finally {
      deletingKeyId = null;
    }
  }

  function handleRowAnnounce(e: CustomEvent<{ text: string }>) {
    announce(e.detail.text);
  }

  async function copyNewKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.raw);
      copiedKey = true;
      announce("Copied.");
      setTimeout(() => (copiedKey = false), 2000);
    } catch {
      copiedKey = false;
    }
  }

  async function copyNewEndpoint() {
    if (!newKeyEndpoint) return;
    try {
      await navigator.clipboard.writeText(newKeyEndpoint);
      copiedEndpoint = true;
      announce("Copied.");
      setTimeout(() => (copiedEndpoint = false), 2000);
    } catch {
      copiedEndpoint = false;
    }
  }
</script>

<section class="manager" aria-labelledby="m4-connect-heading">
  <!-- Persistent polite region — outside every {#if}, rendered empty at boot. -->
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announceText}</div>

  {#if newKey}
    <!-- S1/S2 · SUCCESS (copy pack §4.3) — display-once key, one yellow primary → Home's ask. -->
    <div class="success">
      <h2 id="m4-success-heading" class="surface-h" tabindex="-1">Connection created</h2>
      <div class="key-box">
        <p class="kb-label">Your connection key</p>
        <p class="kb-warning">
          This is the only time the full key is shown. Copy it now and store it somewhere safe.
        </p>
        <code class="kb-value">{newKey.raw}</code>
        <div class="kb-actions">
          <button type="button" class="btn btn-secondary" on:click={copyNewKey}>
            {copiedKey ? "Copied." : "Copy key"}
          </button>
        </div>
      </div>
      <div class="ep-box">
        <p class="kb-label">Endpoint</p>
        <code class="kb-value">{newKeyEndpoint}</code>
        <div class="kb-actions">
          <button type="button" class="btn btn-secondary" on:click={copyNewEndpoint}>
            {copiedEndpoint ? "Copied." : "Copy"}
          </button>
        </div>
      </div>
      <p class="setup-hint">
        {#if newKey.method === "mcp"}
          Paste the endpoint and key into your agent's MCP settings.
        {:else}
          Call the endpoint with your key in the Authorization header.
        {/if}
      </p>
      <div class="success-cta">
        <a class="btn btn-primary" href={HOME_HREF}>Ask a question →</a>
        <p class="cta-sub">See what your app sees — every answer with its citations.</p>
      </div>
    </div>
  {:else if surface === "s0"}
    <!-- S0 · LOCKED (copy pack §4.1) — no completed ingest; nothing else renders. -->
    <div class="locked">
      <h2 id="m4-connect-heading" class="surface-h" tabindex="-1">Nothing to connect yet</h2>
      <p class="locked-body">
        Connect is where your app or AI agent gets access to your answers. First, add some
        documents so there's something to answer from.
      </p>
      <a class="btn btn-primary" href={BUILD_HREF}>Add your documents →</a>
    </div>
  {:else if surface === "s1"}
    <!-- S1 · GUIDED FORK (copy pack §4.2) — cue bar kept with its shipped strings. -->
    <h2 id="m4-connect-heading" class="sr-only" tabindex="-1">Connect</h2>
    <div class="cue">
      <StateChip state="running" label={`M4 · ${MILESTONE_LABEL.m4}`} />
      <span class="cue-text">Create your first connection to let your app reach your graph.</span>
    </div>
    <ConnectWizard
      {creating}
      {createError}
      access="read"
      variant="first"
      projects={setup.projects}
      bind:projectId
      {projectAmbiguous}
      on:create={handleCreate}
    />
  {:else}
    <!-- S2 · MANAGER (copy pack §4.4) — list-plus-nudge; no yellow primary in the steady state. -->
    <header class="mgr-head">
      <h2 id="m4-connect-heading" class="surface-h" tabindex="-1">Connections</h2>
      <button
        type="button"
        class="btn btn-secondary"
        id="m4-add-connection"
        aria-expanded={addFormOpen}
        on:click={toggleAddForm}
      >
        + Add connection
      </button>
    </header>

    <ul class="conn-list">
      {#each connections as conn (conn.keyId)}
        <ConnectionRow
          connection={conn}
          connectApiBase={setup.connectApiBase}
          deleting={deletingKeyId === conn.keyId}
          live={liveIds.includes(conn.keyId)}
          on:delete={handleDelete}
          on:announce={handleRowAnnounce}
        />
      {/each}
    </ul>

    {#if showReadWriteSuggestion(connections) && !addFormOpen}
      <p class="suggestion">
        Need your app to add or update facts in your graph too?
        <button type="button" class="suggest-link" on:click={() => openAddForm("read_write")}>
          Add a read + write connection</button
        >.
      </p>
    {/if}

    {#if addFormOpen}
      <ConnectWizard
        {creating}
        {createError}
        access={addFormAccess}
        variant="add"
        projects={setup.projects}
        bind:projectId
        {projectAmbiguous}
        on:create={handleCreate}
      />
    {/if}
  {/if}
</section>

<style>
  .manager {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  .surface-h {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: -0.01em;
    line-height: 0.95;
    margin: 0;
    font-size: 1.9rem;
  }
  .surface-h:focus {
    /* Programmatic-only focus target (state-swap relocation) — no visible ring. */
    outline: none;
  }

  /* S0 — locked */
  .locked {
    border: 2px dashed var(--color-ink);
    background: var(--color-surface);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }
  .locked-body {
    margin: 0;
    color: var(--color-ink-muted);
    line-height: 1.55;
    max-width: 52ch;
  }

  /* S1 — cue bar (shipped chrome, unchanged) */
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

  /* S2 — manager */
  .mgr-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .conn-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .suggestion {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    line-height: 1.6;
    max-width: 62ch;
  }
  .suggest-link {
    border: none;
    background: none;
    font: inherit;
    color: var(--color-ink);
    text-decoration: underline;
    cursor: pointer;
    padding: var(--space-2);
    margin: calc(-1 * var(--space-2)) 0;
    min-height: 44px;
  }
  .suggest-link:focus-visible {
    /* Ink-paired focus (a11y skill §Focus / WCAG 1.4.11). */
    outline: 2px solid var(--color-yellow);
    outline-offset: 0;
    box-shadow: 0 0 0 4px var(--color-ink);
  }

  /* Success (§4.3) */
  .success {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    border: 2px solid var(--color-ink);
    background: var(--color-bg);
    box-shadow: var(--shadow-md);
    padding: var(--space-5);
  }
  .key-box {
    border: 2px solid var(--color-ink);
    background: color-mix(in srgb, var(--color-yellow) 12%, var(--color-surface));
    padding: var(--space-3);
  }
  .ep-box {
    border: 2px solid var(--color-ink);
    background: var(--color-surface);
    padding: var(--space-3);
  }
  .kb-label {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink-muted);
  }
  .kb-warning {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.5;
    max-width: 62ch;
  }
  .kb-value {
    display: block;
    word-break: break-all;
    font-size: 0.85rem;
    padding: var(--space-2);
    background: var(--color-bg);
    border: var(--border-thin);
  }
  .kb-actions {
    margin-top: var(--space-2);
  }
  .setup-hint {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    line-height: 1.5;
  }
  .success-cta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .cta-sub {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
  }
</style>
