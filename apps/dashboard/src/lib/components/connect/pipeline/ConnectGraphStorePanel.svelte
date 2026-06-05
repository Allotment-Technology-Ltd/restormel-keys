<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { page } from "$app/stores";
  import {
    CONNECT_PIPELINE_API,
    type GraphTarget,
  } from "$lib/connect/pipeline-config";
  import { pipelineStatusClass } from "$lib/connect/pipeline-utils";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  export let embedded = false;

  $: neonGraphStoreOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).connectNeonGraphStore;

  const dispatch = createEventDispatcher<{ updated: void }>();
  const API_BASE = CONNECT_PIPELINE_API;

  function notifyUpdated() {
    dispatch("updated");
  }

  let loading = true;
  let loadError: string | null = null;

  let target: GraphTarget = null;
  let endpoint = "";
  let namespace = "";
  let database = "";
  let username = "";
  let secret = "";
  let savingTarget = false;
  let targetMsg: string | null = null;
  let testing = false;
  let testMsg: string | null = null;
  let testError = false;

  let connStr = "";
  let connecting = false;
  let connMsg: string | null = null;
  let connError = false;
  let showAdvanced = false;
  let parsedPreview: {
    endpoint?: string;
    namespace?: string;
    database?: string;
    token_present?: boolean;
    username_present?: boolean;
  } | null = null;

  let connectingNeon = false;
  let neonMsg: string | null = null;
  let neonError = false;

  function applyParsedToForm(parsed: typeof parsedPreview) {
    if (!parsed) return;
    parsedPreview = parsed;
    if (parsed.endpoint) endpoint = parsed.endpoint;
    if (parsed.namespace) namespace = parsed.namespace;
    else if (parsed.endpoint) namespace = "";
    if (parsed.database) database = parsed.database;
    else if (parsed.endpoint) database = "";
  }

  function clearParsedPreview() {
    parsedPreview = null;
  }

  function applyTargetToForm(t: GraphTarget) {
    target = t;
    if (t) {
      endpoint = t.connection.endpoint ?? "";
      namespace = t.connection.namespace ?? "";
      database = t.connection.database ?? "";
      username = t.connection.username ?? "";
    }
  }

  async function loadGraphTarget() {
    loading = true;
    loadError = null;
    try {
      const tRes = await fetch(API_BASE + "/pipeline/graph-target");
      if (tRes.status === 401) {
        loadError = "Sign in to configure the graph store.";
        return;
      }
      if (tRes.ok) {
        const d = await tRes.json();
        applyTargetToForm(d.target ?? null);
      }
    } catch {
      loadError = "Could not load graph store configuration.";
    } finally {
      loading = false;
    }
  }

  async function refreshTargetStatus() {
    try {
      const tRes = await fetch(API_BASE + "/pipeline/graph-target");
      if (tRes.ok) {
        const d = await tRes.json();
        applyTargetToForm(d.target ?? null);
      }
    } catch {
      // non-fatal
    }
  }

  async function saveTarget() {
    savingTarget = true;
    targetMsg = null;
    try {
      const res = await fetch(API_BASE + "/pipeline/graph-target", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "surreal",
          endpoint: endpoint.trim(),
          namespace: namespace.trim(),
          database: database.trim(),
          ...(username.trim() ? { username: username.trim() } : {}),
          ...(secret.trim() ? { secret: secret.trim() } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        targetMsg = d.message ?? `Could not save (HTTP ${res.status}).`;
        return;
      }
      applyTargetToForm(d.target ?? null);
      secret = "";
      targetMsg = d.test?.message ?? "Graph store saved.";
      notifyUpdated();
    } catch {
      targetMsg = "Network error while saving.";
    } finally {
      savingTarget = false;
    }
  }

  async function connectNeon() {
    connectingNeon = true;
    neonMsg = null;
    neonError = false;
    try {
      const res = await fetch(API_BASE + "/pipeline/graph-target/neon", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        neonError = true;
        neonMsg = d.message ?? `Could not connect (HTTP ${res.status}).`;
        return;
      }
      applyTargetToForm(d.target ?? null);
      neonError = !(d.test?.ok ?? false);
      neonMsg = d.test?.message ?? "Connected to this workspace's Neon database.";
      notifyUpdated();
    } catch {
      neonError = true;
      neonMsg = "Network error while connecting.";
    } finally {
      connectingNeon = false;
    }
  }

  async function quickConnect() {
    connecting = true;
    connMsg = null;
    connError = false;
    try {
      const res = await fetch(API_BASE + "/pipeline/graph-target/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_string: connStr.trim(),
          ...(namespace.trim() ? { namespace: namespace.trim() } : {}),
          ...(database.trim() ? { database: database.trim() } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 400 && d.error === "incomplete_connection") {
        connError = true;
        connMsg = d.message ?? "Add a namespace and database below.";
        showAdvanced = true;
        applyParsedToForm(d.parsed ?? null);
        return;
      }
      if (res.status === 400 && d.error === "invalid_connection_string") {
        connError = true;
        connMsg = d.message ?? "Could not parse the connection string.";
        clearParsedPreview();
        return;
      }
      if (!res.ok) {
        connError = true;
        connMsg = d.message ?? `Could not connect (HTTP ${res.status}).`;
        return;
      }
      applyTargetToForm(d.target ?? null);
      connStr = "";
      clearParsedPreview();
      connError = !(d.test?.ok ?? false);
      connMsg = d.test?.message ?? "Saved.";
      notifyUpdated();
    } catch {
      connError = true;
      connMsg = "Network error while connecting.";
    } finally {
      connecting = false;
    }
  }

  function testDraftPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (endpoint.trim()) payload.endpoint = endpoint.trim();
    if (namespace.trim()) payload.namespace = namespace.trim();
    if (database.trim()) payload.database = database.trim();
    if (username.trim()) payload.username = username.trim();
    if (secret.trim()) payload.secret = secret.trim();
    if (connStr.trim()) payload.connection_string = connStr.trim();
    if (target?.secret_set && !secret.trim()) payload.use_saved_secret = true;
    return payload;
  }

  $: canTestConnection =
    Boolean(target) ||
    Boolean(
      endpoint.trim() &&
        namespace.trim() &&
        database.trim() &&
        (secret.trim() || target?.secret_set || connStr.trim()),
    );

  async function testConnection() {
    testing = true;
    testMsg = null;
    testError = false;
    try {
      const draft = testDraftPayload();
      const res = await fetch(API_BASE + "/pipeline/graph-target/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.keys(draft).length > 0 ? draft : {}),
      });
      const d = await res.json().catch(() => ({}));
      testError = !(d.ok ?? false);
      testMsg = d.message ?? (testError ? "Connection failed." : "Connection succeeded.");
      if (target) await refreshTargetStatus();
    } catch {
      testError = true;
      testMsg = "Network error while testing.";
    } finally {
      testing = false;
    }
  }

  $: storeConnected = Boolean(target && (target.status === "ok" || target.secret_set));
  $: storeDisplayUrl =
    target?.provider === "postgres" && target.use_dashboard_database
      ? "Workspace Neon database"
      : target?.connection.endpoint ?? (target ? target.provider : "Not connected");
  $: storeNsDb =
    target?.connection.namespace && target?.connection.database
      ? `${target.connection.namespace} · ${target.connection.database}`
      : null;

  onMount(() => {
    loadGraphTarget();
  });
</script>

{#if loading}
  <p class="muted" role="status">Loading graph store…</p>
{:else if loadError}
  <p class="err" role="alert">{loadError}</p>
{:else}
  <div class="wizard-panel" class:card={!embedded} aria-labelledby={embedded ? undefined : "store-heading"}>
    {#if !embedded}
      <h2 id="store-heading" class="h2">Graph store</h2>
      <p class="card-desc">
        {#if neonGraphStoreOn}
          Connect your own SurrealDB instance or use this workspace's Neon database.
        {:else}
          Connect your own SurrealDB instance (Surreal Cloud or self-hosted).
        {/if}
        {#if target}
          <span class="badge {pipelineStatusClass(target.status)}">{target.status}</span>
        {/if}
      </p>
    {/if}

    <div
      class="store-status-card"
      class:store-status-card-ok={storeConnected}
      class:store-status-card-error={!storeConnected}
      role="status"
      aria-label="Graph store connection status"
    >
      <span class="store-status-glyph" aria-hidden="true">{storeConnected ? "■" : "□"}</span>
      <div class="store-status-main">
        <code class="store-status-url" title={storeDisplayUrl}>{storeDisplayUrl}</code>
        {#if storeNsDb}
          <span class="store-status-ns">{storeNsDb}</span>
        {/if}
      </div>
      <button
        type="button"
        class="store-test-link"
        on:click={testConnection}
        disabled={testing || !canTestConnection}
      >
        {testing ? "Testing…" : "Test connection"}
        {#if testMsg && !testing}
          <span class="store-test-result" class:store-test-fail={testError}>{testError ? "✗" : "✓"}</span>
        {/if}
      </button>
    </div>

    <hr class="store-divider" />

    {#if neonGraphStoreOn}
      <div class="oneclick">
        <div class="oneclick-text">
          <strong>Use this workspace's Neon database</strong>
          <span class="field-hint">One click — reuses your dashboard's existing Neon connection. No credentials, no setup.</span>
        </div>
        <button type="button" class="btn btn-primary" on:click={connectNeon} disabled={connectingNeon}>
          {connectingNeon ? "Connecting…" : "Use Neon"}
        </button>
      </div>
      {#if neonMsg}<p class:err={neonError} class:notice={!neonError} role="status">{neonMsg}</p>{/if}

      <p class="or-sep"><span>or bring your own SurrealDB</span></p>
    {/if}

    <form class="form quick" on:submit|preventDefault={quickConnect}>
      <label class="field">
        <span class="field-label">Change connection</span>
        <input
          class="input"
          type="text"
          bind:value={connStr}
          autocomplete="off"
          placeholder="wss://your-instance.surreal.cloud or Server=wss://…;Namespace=…;Database=…"
        />
        <span class="field-hint">
          Paste a WebSocket URL, a Surreal Cloud CLI command (<code>surreal sql --endpoint wss://… --token …</code>),
          or an ADO-style string. If the CLI omits <code>--ns</code>/<code>--db</code>, add namespace and database
          manually below — we read them from the JWT when present.
          <a href="https://surrealdb.com/docs/build/deployment/surrealdb-cloud/connecting/via-sdk" target="_blank" rel="noopener noreferrer">Where to find this</a>.
        </span>
      </label>
      {#if connMsg}<p class:err={connError} class:notice={!connError} role="status">{connMsg}</p>{/if}
      {#if parsedPreview}
        <div class="parsed-preview" role="status" aria-label="Parsed connection details">
          <p class="parsed-preview-title">Parsed from your paste</p>
          <dl class="parsed-preview-list">
            <div>
              <dt>Endpoint</dt>
              <dd><code>{parsedPreview.endpoint ?? "—"}</code></dd>
            </div>
            {#if parsedPreview.token_present}
              <div>
                <dt>Token</dt>
                <dd>Captured — re-used when you click Connect again</dd>
              </div>
            {/if}
            <div>
              <dt>Namespace</dt>
              <dd>{parsedPreview.namespace ?? "Add below"}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{parsedPreview.database ?? "Add below"}</dd>
            </div>
          </dl>
        </div>
      {/if}
      <div class="actions">
        <button type="submit" class="btn btn-primary" disabled={connecting || !connStr.trim()}>
          {connecting ? "Connecting…" : "Connect"}
        </button>
        <button type="button" class="btn btn-outline" on:click={() => (showAdvanced = !showAdvanced)}>
          {showAdvanced ? "Hide manual fields" : "Enter fields manually"}
        </button>
      </div>
    </form>

    {#if showAdvanced}
      <form class="form advanced" on:submit|preventDefault={saveTarget}>
        <label class="field">
          <span class="field-label">Endpoint URL</span>
          <input class="input" type="url" bind:value={endpoint} placeholder="https://your-surreal-host:8000" required />
        </label>
        <div class="row">
          <label class="field">
            <span class="field-label">Namespace</span>
            <input class="input" type="text" bind:value={namespace} placeholder="restormel" required />
          </label>
          <label class="field">
            <span class="field-label">Database</span>
            <input class="input" type="text" bind:value={database} placeholder="knowledge" required />
          </label>
        </div>
        <div class="row">
          <label class="field">
            <span class="field-label">Username (optional)</span>
            <input class="input" type="text" bind:value={username} autocomplete="off" />
          </label>
          <label class="field">
            <span class="field-label">Password / token {#if target?.secret_set}<span class="field-hint">(leave blank to keep)</span>{/if}</span>
            <input class="input" type="password" bind:value={secret} autocomplete="new-password" placeholder="••••••••" />
          </label>
        </div>
        <p class="field-hint">
          Surreal Cloud CLI tokens: leave <strong>Username</strong> empty and paste the token here.
          Namespace or database <code>DEFINE USER</code> accounts: enter username and password — Connect signs in via Surreal’s HTTP API before testing or ingesting.
        </p>
        {#if targetMsg}<p class="notice" role="status">{targetMsg}</p>{/if}
        {#if testMsg}
          <p class:err={testError} class:notice={!testError} role="status">{testMsg}</p>
        {/if}
        {#if target?.last_error}<p class="err">Last error: {target.last_error}</p>{/if}
        <p class="field-hint">Test uses the values above without saving. Use <strong>Save graph store</strong> to persist.</p>
        <div class="actions">
          <button type="submit" class="btn btn-primary" disabled={savingTarget}>
            {savingTarget ? "Saving…" : "Save graph store"}
          </button>
          <button type="button" class="btn btn-secondary" on:click={testConnection} disabled={testing || !canTestConnection}>
            {testing ? "Testing…" : "Test connection"}
          </button>
        </div>
      </form>
    {/if}
  </div>
{/if}
