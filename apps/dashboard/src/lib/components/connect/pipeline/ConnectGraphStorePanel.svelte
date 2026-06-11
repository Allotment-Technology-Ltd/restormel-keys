<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { page } from "$app/stores";
  import {
    CONNECT_PIPELINE_API,
    type GraphTarget,
  } from "$lib/connect/pipeline-config";
  import { pipelineStatusClass } from "$lib/connect/pipeline-utils";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";

  export let embedded = false;

  $: neonGraphStoreOn = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).connectNeonGraphStore;

  const dispatch = createEventDispatcher<{ updated: void }>();
  const API_BASE = CONNECT_PIPELINE_API;

  function notifyUpdated() {
    dispatch("updated");
  }

  let loading = true;
  let loadError: string | null = null;
  let loadErrorAuth = false;

  let target: GraphTarget = null;
  let endpoint = "";
  let namespace = "";
  let database = "";
  let username = "";
  let secret = "";
  /** Stage 3.2b: user opt-in to let Restormel manage restormel_claim_versions. Default OFF. */
  let allowClaimVersionsTable = false;
  let savingTarget = false;
  let targetMsg: string | null = null;
  let targetErr = false;
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

  // ── Multi-database selector (Build 2A) ──────────────────────────────
  type DbKind = "surrealdb" | "neo4j" | "weaviate" | "neptune";
  let dbKind: DbKind = "surrealdb";
  const DB_KINDS: DbKind[] = ["surrealdb", "neo4j", "weaviate", "neptune"];
  const COMING_SOON: DbKind[] = ["neptune"];
  const DB_LABELS: Record<DbKind, string> = {
    surrealdb: "SurrealDB",
    neo4j: "Neo4j",
    weaviate: "Weaviate",
    neptune: "Neptune",
  };

  // Neo4j connection form + saved config state.
  let neo4jUri = "";
  let neo4jUsername = "neo4j";
  let neo4jPassword = "";
  let neo4jDatabase = "neo4j";
  let neo4jSecretSet = false;
  let neo4jSaving = false;
  let neo4jTesting = false;
  let neo4jMsg: string | null = null;
  let neo4jError = false;
  const GRAPH_STORE_CONFIG_API = API_BASE + "/pipeline/graph-store-config";

  // Weaviate connection form + saved config state (Sprint 2 / Build 5A).
  let weaviateEndpoint = "";
  let weaviateApiKey = "";
  let weaviatePrefix = "";
  let weaviateSecretSet = false;
  let weaviateSaving = false;
  let weaviateTesting = false;
  let weaviateMsg: string | null = null;
  let weaviateError = false;

  async function loadGraphStoreConfig() {
    try {
      const res = await fetch(GRAPH_STORE_CONFIG_API);
      if (!res.ok) return;
      const d = await res.json();
      if (d.config?.type === "neo4j") {
        neo4jUri = d.config.connection_string ?? "";
        neo4jUsername = d.config.username ?? "neo4j";
        neo4jDatabase = d.config.database ?? "neo4j";
        neo4jSecretSet = Boolean(d.config.secret_set);
        dbKind = "neo4j"; // a saved Neo4j config wins the initial selection
      } else if (d.config?.type === "weaviate") {
        weaviateEndpoint = d.config.endpoint ?? "";
        weaviatePrefix = d.config.collection_prefix ?? "";
        weaviateSecretSet = Boolean(d.config.secret_set);
        dbKind = "weaviate";
      }
    } catch {
      // non-fatal
    }
  }

  async function saveWeaviate() {
    weaviateSaving = true;
    weaviateMsg = null;
    weaviateError = false;
    try {
      const res = await fetch(GRAPH_STORE_CONFIG_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "weaviate",
          endpoint: weaviateEndpoint.trim(),
          collection_prefix: weaviatePrefix.trim(),
          ...(weaviateApiKey.trim() ? { secret: weaviateApiKey.trim() } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        weaviateError = true;
        weaviateMsg = d.message ?? `Could not save (HTTP ${res.status}).`;
        return;
      }
      weaviateSecretSet = Boolean(d.config?.secret_set);
      weaviateApiKey = "";
      weaviateError = !(d.test?.ok ?? false);
      weaviateMsg = d.test?.ok
        ? "Saved — connection healthy."
        : `Saved, but connection test failed: ${d.test?.error ?? "unknown error"}`;
      notifyUpdated();
    } catch {
      weaviateError = true;
      weaviateMsg = "Network error while saving.";
    } finally {
      weaviateSaving = false;
    }
  }

  async function testWeaviate() {
    weaviateTesting = true;
    weaviateMsg = null;
    weaviateError = false;
    try {
      const res = await fetch(GRAPH_STORE_CONFIG_API + "/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "weaviate",
          endpoint: weaviateEndpoint.trim(),
          ...(weaviateApiKey.trim() ? { secret: weaviateApiKey.trim() } : { use_saved_secret: weaviateSecretSet }),
        }),
      });
      const d = await res.json().catch(() => ({}));
      weaviateError = !(d.ok ?? false);
      weaviateMsg = d.ok ? "Connection succeeded." : `Connection failed: ${d.error ?? "unknown error"}`;
    } catch {
      weaviateError = true;
      weaviateMsg = "Network error while testing.";
    } finally {
      weaviateTesting = false;
    }
  }

  $: weaviateCanTest = Boolean(weaviateEndpoint.trim() && (weaviateApiKey.trim() || weaviateSecretSet));

  function selectDb(kind: DbKind) {
    if (COMING_SOON.includes(kind)) return;
    dbKind = kind;
  }

  async function saveNeo4j() {
    neo4jSaving = true;
    neo4jMsg = null;
    neo4jError = false;
    try {
      const res = await fetch(GRAPH_STORE_CONFIG_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "neo4j",
          connection_string: neo4jUri.trim(),
          database: neo4jDatabase.trim() || "neo4j",
          username: neo4jUsername.trim() || "neo4j",
          ...(neo4jPassword.trim() ? { secret: neo4jPassword.trim() } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        neo4jError = true;
        neo4jMsg = d.message ?? `Could not save (HTTP ${res.status}).`;
        return;
      }
      neo4jSecretSet = Boolean(d.config?.secret_set);
      neo4jPassword = "";
      neo4jError = !(d.test?.ok ?? false);
      neo4jMsg = d.test?.ok
        ? "Saved — connection healthy."
        : `Saved, but connection test failed: ${d.test?.error ?? "unknown error"}`;
      notifyUpdated();
    } catch {
      neo4jError = true;
      neo4jMsg = "Network error while saving.";
    } finally {
      neo4jSaving = false;
    }
  }

  async function testNeo4j() {
    neo4jTesting = true;
    neo4jMsg = null;
    neo4jError = false;
    try {
      const res = await fetch(GRAPH_STORE_CONFIG_API + "/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "neo4j",
          connection_string: neo4jUri.trim(),
          database: neo4jDatabase.trim() || "neo4j",
          username: neo4jUsername.trim() || "neo4j",
          ...(neo4jPassword.trim() ? { secret: neo4jPassword.trim() } : { use_saved_secret: neo4jSecretSet }),
        }),
      });
      const d = await res.json().catch(() => ({}));
      neo4jError = !(d.ok ?? false);
      neo4jMsg = d.ok ? "Connection succeeded." : `Connection failed: ${d.error ?? "unknown error"}`;
    } catch {
      neo4jError = true;
      neo4jMsg = "Network error while testing.";
    } finally {
      neo4jTesting = false;
    }
  }

  $: neo4jCanTest = Boolean(neo4jUri.trim() && (neo4jPassword.trim() || neo4jSecretSet));

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
      allowClaimVersionsTable = t.bundle?.allow_claim_versions_table ?? false;
    }
  }

  async function loadGraphTarget() {
    loading = true;
    loadError = null;
    loadErrorAuth = false;
    try {
      const tRes = await fetch(API_BASE + "/pipeline/graph-target");
      if (tRes.status === 401) {
        loadError = "Sign in to configure the graph store.";
        loadErrorAuth = true;
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
    targetErr = false;
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
          allow_claim_versions_table: allowClaimVersionsTable,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        targetErr = true;
        targetMsg = d.message ?? `Could not save (HTTP ${res.status}).`;
        return;
      }
      applyTargetToForm(d.target ?? null);
      secret = "";
      targetErr = !(d.test?.ok ?? true);
      targetMsg = d.test?.message ?? "Graph store saved.";
      notifyUpdated();
    } catch {
      targetErr = true;
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
    loadGraphStoreConfig();
  });
</script>

{#if loading}
  <p class="muted" role="status">Loading graph store…</p>
{:else if loadError}
  <BrutalErrorBanner title="Graph store" message={loadError} />
  <div class="actions">
    {#if loadErrorAuth}
      <a class="btn btn-primary btn-sm" href="{DASHBOARD_BASE}/login">Sign in</a>
    {:else}
      <button type="button" class="btn btn-primary btn-sm" on:click={loadGraphTarget}>Try again</button>
    {/if}
  </div>
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

    <div class="db-selector" role="group" aria-label="Graph database type">
      {#each DB_KINDS as kind (kind)}
        <button
          type="button"
          class="db-chip"
          class:db-chip-active={dbKind === kind}
          class:db-chip-soon={COMING_SOON.includes(kind)}
          aria-pressed={dbKind === kind}
          disabled={COMING_SOON.includes(kind)}
          on:click={() => selectDb(kind)}
        >
          {DB_LABELS[kind]}
          {#if COMING_SOON.includes(kind)}<span class="db-chip-soon-tag">soon</span>{/if}
        </button>
      {/each}
    </div>

    {#if dbKind === "surrealdb"}
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
      {#if neonMsg}<p class:err={neonError} class:notice={!neonError} role={neonError ? "alert" : "status"}>{neonMsg}</p>{/if}

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
      {#if connMsg}<p class:err={connError} class:notice={!connError} role={connError ? "alert" : "status"}>{connMsg}</p>{/if}
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

        <div class="version-table-opt-in" role="group" aria-labelledby="vt-heading">
          <div class="version-table-opt-in-header">
            <strong id="vt-heading">Incremental re-ingest (claim versions)</strong>
            <label class="toggle-label" for="allow-claim-versions">
              <input
                id="allow-claim-versions"
                type="checkbox"
                bind:checked={allowClaimVersionsTable}
                class="toggle-input"
              />
              <span class="toggle-track" aria-hidden="true"></span>
              <span class="sr-only">{allowClaimVersionsTable ? "On" : "Off"}</span>
            </label>
          </div>
          <p class="field-hint">
            <strong>Allow Restormel to manage claim versions in this database.</strong>
            {#if allowClaimVersionsTable}
              <span class="vt-on-badge">ON</span>
            {/if}
          </p>
          <p class="field-hint">
            When ON, Restormel creates one table — <code>restormel_claim_versions</code> — in this
            Surreal database. The table is <strong>additive-only</strong>: Restormel writes to it but
            never alters or drops your existing tables. Re-ingesting a changed source will update only
            that source’s claims instead of re-running the full graph.
          </p>
          {#if allowClaimVersionsTable}
            <p class="field-hint vt-revoke">
              To revoke: turn this off and save. Future runs will not write to
              <code>restormel_claim_versions</code>. You can drop the table from your Surreal database
              at any time with <code>REMOVE TABLE restormel_claim_versions;</code>
            </p>
          {:else}
            <p class="field-hint">
              <strong>Off (default):</strong> every re-ingest runs as a full ingest; no Restormel-owned
              tables are created in your database.
            </p>
          {/if}
          <p class="field-hint vt-permissions">
            The Surreal user above must have <code>DEFINE TABLE</code> permissions for this to work.
            If it cannot create the table, the run degrades to full ingest with an operator warning —
            it never blocks the run or silently pretends versions exist.
          </p>
        </div>

        {#if targetMsg}<p class:err={targetErr} class:notice={!targetErr} role={targetErr ? "alert" : "status"}>{targetMsg}</p>{/if}
        {#if testMsg}
          <p class:err={testError} class:notice={!testError} role={testError ? "alert" : "status"}>{testMsg}</p>
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
    {:else if dbKind === "neo4j"}
      <p class="notice" role="status">
        Ingest runs don't write to Neo4j yet — your settings are saved and testable now, ready for
        adapter support. To continue the wizard, connect <strong>SurrealDB</strong> or use the
        <strong>workspace Neon database</strong>.
      </p>
      <form class="form" on:submit|preventDefault={saveNeo4j}>
        <p class="card-desc">
          Connect an existing Neo4j 5.x graph (Aura or self-hosted). Restormel writes claims as
          <code>:Claim</code> nodes with a vector index for retrieval.
          {#if neo4jSecretSet}<span class="badge ok">configured</span>{/if}
        </p>
        <label class="field">
          <span class="field-label">Bolt / connection URI</span>
          <input
            class="input"
            type="text"
            bind:value={neo4jUri}
            autocomplete="off"
            placeholder="neo4j+s://xxxx.databases.neo4j.io or bolt://host:7687"
            required
          />
          <span class="field-hint">Use <code>neo4j+s://</code> for Aura, <code>bolt://</code> for self-hosted.</span>
        </label>
        <div class="row">
          <label class="field">
            <span class="field-label">Username</span>
            <input class="input" type="text" bind:value={neo4jUsername} autocomplete="off" placeholder="neo4j" />
          </label>
          <label class="field">
            <span class="field-label">Database</span>
            <input class="input" type="text" bind:value={neo4jDatabase} autocomplete="off" placeholder="neo4j" />
          </label>
        </div>
        <label class="field">
          <span class="field-label">
            Password {#if neo4jSecretSet}<span class="field-hint">(leave blank to keep)</span>{/if}
          </span>
          <input
            class="input"
            type="password"
            bind:value={neo4jPassword}
            autocomplete="new-password"
            placeholder="••••••••"
          />
        </label>
        {#if neo4jMsg}
          <p class:err={neo4jError} class:notice={!neo4jError} role={neo4jError ? "alert" : "status"}>{neo4jMsg}</p>
        {/if}
        <p class="field-hint">Test runs <code>healthCheck()</code> against the database without writing anything.</p>
        <div class="actions">
          <button type="submit" class="btn btn-primary" disabled={neo4jSaving || !neo4jUri.trim()}>
            {neo4jSaving ? "Saving…" : "Save graph store"}
          </button>
          <button type="button" class="btn btn-secondary" on:click={testNeo4j} disabled={neo4jTesting || !neo4jCanTest}>
            {neo4jTesting ? "Testing…" : "Test connection"}
          </button>
        </div>
      </form>
    {:else if dbKind === "weaviate"}
      <p class="notice" role="status">
        Ingest runs don't write to Weaviate yet — your settings are saved and testable now, ready for
        adapter support. To continue the wizard, connect <strong>SurrealDB</strong> or use the
        <strong>workspace Neon database</strong>.
      </p>
      <form class="form" on:submit|preventDefault={saveWeaviate}>
        <p class="card-desc">
          Connect an existing Weaviate instance (Cloud or self-hosted). Restormel adds its
          verification layer on top — best-in-class vector + BM25 hybrid search, with graph
          traversal handled at the application layer (max depth 2).
          {#if weaviateSecretSet}<span class="badge ok">configured</span>{/if}
        </p>
        <label class="field">
          <span class="field-label">REST endpoint</span>
          <input
            class="input"
            type="url"
            bind:value={weaviateEndpoint}
            autocomplete="off"
            placeholder="https://your-cluster.weaviate.network"
            required
          />
          <span class="field-hint">Your Weaviate REST URL (the readiness probe is <code>/v1/.well-known/ready</code>).</span>
        </label>
        <div class="row">
          <label class="field">
            <span class="field-label">
              API key {#if weaviateSecretSet}<span class="field-hint">(leave blank to keep)</span>{/if}
            </span>
            <input
              class="input"
              type="password"
              bind:value={weaviateApiKey}
              autocomplete="new-password"
              placeholder="••••••••"
            />
          </label>
          <label class="field">
            <span class="field-label">Collection prefix (optional)</span>
            <input class="input" type="text" bind:value={weaviatePrefix} autocomplete="off" placeholder="Acme" />
            <span class="field-hint">Nodes → <code>{weaviatePrefix || ""}Claim</code>, edges → <code>{weaviatePrefix || ""}Edge</code>.</span>
          </label>
        </div>
        {#if weaviateMsg}
          <p class:err={weaviateError} class:notice={!weaviateError} role={weaviateError ? "alert" : "status"}>{weaviateMsg}</p>
        {/if}
        <p class="field-hint">Test runs Weaviate's readiness probe against the endpoint without writing anything.</p>
        <div class="actions">
          <button type="submit" class="btn btn-primary" disabled={weaviateSaving || !weaviateEndpoint.trim()}>
            {weaviateSaving ? "Saving…" : "Save graph store"}
          </button>
          <button type="button" class="btn btn-secondary" on:click={testWeaviate} disabled={weaviateTesting || !weaviateCanTest}>
            {weaviateTesting ? "Testing…" : "Test connection"}
          </button>
        </div>
      </form>
    {/if}
  </div>
{/if}

<style>
  .db-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .db-chip {
    position: relative;
    padding: 0.4rem 0.85rem;
    border: 2px solid var(--rm-border, #111);
    background: var(--rm-surface, #fff);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    border-radius: 2px;
  }
  .db-chip-active {
    background: var(--rm-accent, #111);
    color: var(--rm-on-accent, #fff);
  }
  .db-chip-soon,
  .db-chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .db-chip-soon-tag {
    margin-left: 0.4rem;
    font-size: 0.7em;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.8;
  }

  /* Stage 3.2b — version-table opt-in block */
  .version-table-opt-in {
    border: 2px solid var(--rm-border, #111);
    padding: 0.75rem 1rem;
    margin: 1rem 0;
    background: var(--rm-surface, #fff);
  }
  .version-table-opt-in-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  .toggle-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    gap: 0.4rem;
  }
  .toggle-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
  .toggle-track {
    display: inline-block;
    width: 2.4rem;
    height: 1.2rem;
    border: 2px solid var(--rm-border, #111);
    background: var(--rm-surface, #fff);
    position: relative;
    transition: background 100ms;
    flex-shrink: 0;
  }
  .toggle-input:checked + .toggle-track {
    background: var(--rm-accent, #111);
  }
  .toggle-track::after {
    content: "";
    position: absolute;
    top: 1px;
    left: 1px;
    width: 0.8rem;
    height: 0.8rem;
    background: var(--rm-border, #111);
    transition: transform 100ms;
  }
  .toggle-input:checked + .toggle-track::after {
    transform: translateX(1.2rem);
    background: var(--rm-on-accent, #fff);
  }
  .vt-on-badge {
    display: inline-block;
    font-size: 0.7em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: var(--rm-accent, #111);
    color: var(--rm-on-accent, #fff);
    padding: 0.1em 0.4em;
    margin-left: 0.3rem;
    vertical-align: middle;
  }
  .vt-revoke {
    border-left: 3px solid var(--rm-accent, #111);
    padding-left: 0.5rem;
  }
  .vt-permissions {
    color: var(--rm-muted, #555);
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
    border-width: 0;
  }
</style>
