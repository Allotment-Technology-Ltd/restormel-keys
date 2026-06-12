<script lang="ts">
  import { onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { ConnectGraphTarget } from "@restormel/contracts/connect";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";

  /** Saved graphs (one active) and the workspace's domain packs, for the bundle picker. */
  export let initialGraphs: ConnectGraphTarget[] = [];
  export let packs: { id: string; title: string; slug: string }[] = [];

  const API = DASHBOARD_BASE + "/api/connect/graph-library";

  let graphs: ConnectGraphTarget[] = initialGraphs;
  let busyId: string | null = null;
  let banner: { kind: "ok" | "err"; text: string } | null = null;
  // True when the most recent load (refresh) FAILED — so an error never masquerades
  // as the "No graphs saved yet" empty state (filed #289: error-as-empty).
  let loadFailed = false;
  let refreshing = false;

  // Add / edit form state
  let formOpen = false;
  let editingId: string | null = null;
  let fLabel = "";
  let fEndpoint = "";
  let fNamespace = "";
  let fDatabase = "";
  let fUsername = "";
  let fSecret = "";
  let fPackId = "";
  let fActivate = false;
  let saving = false;
  let formMsg: string | null = null;

  function packTitle(id?: string): string | null {
    if (!id) return null;
    return packs.find((p) => p.id === id)?.title ?? null;
  }

  function connSummary(g: ConnectGraphTarget): string {
    if (g.provider === "postgres" && g.use_dashboard_database) return "Workspace Neon database";
    const ns = g.connection.namespace;
    const db = g.connection.database;
    return ns && db ? `${g.connection.endpoint ?? "surreal"} · ${ns}/${db}` : g.connection.endpoint ?? g.provider;
  }

  async function refresh() {
    refreshing = true;
    try {
      const res = await fetch(API);
      if (res.ok) {
        const d = await res.json();
        graphs = d.graphs ?? [];
        loadFailed = false;
      } else {
        // Load failed — surface it as an error with retry, NOT as "no graphs".
        loadFailed = true;
      }
    } catch {
      loadFailed = true;
    } finally {
      refreshing = false;
    }
  }

  function setBanner(kind: "ok" | "err", text: string) {
    banner = { kind, text };
  }

  function openAdd() {
    editingId = null;
    fLabel = "";
    fEndpoint = "";
    fNamespace = "";
    fDatabase = "";
    fUsername = "";
    fSecret = "";
    fPackId = "";
    fActivate = graphs.length === 0;
    formMsg = null;
    formOpen = true;
  }

  function openEdit(g: ConnectGraphTarget) {
    editingId = g.id;
    fLabel = g.label ?? "";
    fEndpoint = g.connection.endpoint ?? "";
    fNamespace = g.connection.namespace ?? "";
    fDatabase = g.connection.database ?? "";
    fUsername = g.connection.username ?? "";
    fSecret = "";
    fPackId = g.bundle?.default_domain_pack_id ?? "";
    fActivate = false;
    formMsg = null;
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
    editingId = null;
  }

  async function submitForm() {
    saving = true;
    formMsg = null;
    const payload: Record<string, unknown> = {
      provider: "surreal",
      endpoint: fEndpoint.trim(),
      namespace: fNamespace.trim(),
      database: fDatabase.trim(),
    };
    if (fLabel.trim()) payload.label = fLabel.trim();
    if (fUsername.trim()) payload.username = fUsername.trim();
    if (fSecret.trim()) payload.secret = fSecret.trim();
    if (fPackId) payload.default_domain_pack_id = fPackId;
    try {
      const url = editingId ? `${API}/${editingId}` : API;
      const method = editingId ? "PUT" : "POST";
      if (!editingId) payload.activate = fActivate;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        formMsg = d.message ?? `Could not save (HTTP ${res.status}).`;
        return;
      }
      graphs = d.graphs ?? graphs;
      const verb = editingId ? "updated" : "added";
      setBanner(
        d.test && d.test.ok === false ? "err" : "ok",
        d.test?.message ? `Graph ${verb}. ${d.test.message}` : `Graph ${verb}.`,
      );
      closeForm();
    } catch {
      formMsg = "Network error while saving.";
    } finally {
      saving = false;
    }
  }

  async function activate(g: ConnectGraphTarget) {
    busyId = g.id;
    banner = null;
    try {
      const res = await fetch(`${API}/${g.id}/activate`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner("err", d.message ?? "Could not activate graph.");
        return;
      }
      graphs = d.graphs ?? graphs;
      setBanner("ok", `“${g.label ?? connSummary(g)}” is now your active graph.`);
    } catch {
      setBanner("err", "Network error while switching graph.");
    } finally {
      busyId = null;
    }
  }

  async function test(g: ConnectGraphTarget) {
    busyId = g.id;
    banner = null;
    try {
      const res = await fetch(`${API}/${g.id}/test`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (d.graphs) graphs = d.graphs;
      setBanner(d.test?.ok ? "ok" : "err", d.test?.message ?? "Connection test finished.");
    } catch {
      setBanner("err", "Network error while testing.");
    } finally {
      busyId = null;
    }
  }

  async function remove(g: ConnectGraphTarget) {
    if (!confirm(`Delete “${g.label ?? connSummary(g)}” from your Graph Library? This does not touch the underlying database.`)) {
      return;
    }
    busyId = g.id;
    banner = null;
    try {
      const res = await fetch(`${API}/${g.id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner("err", d.message ?? "Could not delete graph.");
        return;
      }
      graphs = d.graphs ?? graphs;
      setBanner("ok", "Graph removed from your library.");
    } catch {
      setBanner("err", "Network error while deleting.");
    } finally {
      busyId = null;
    }
  }

  onMount(() => {
    if (initialGraphs.length === 0) refresh();
  });
</script>

<div class="library">
  <header class="library-head">
    <div>
      <h2 class="h2">Graph Library</h2>
      <p class="card-desc">
        Save every graph store you work with — each remembers its own domain pack, document selection, and
        run defaults. Activate one to point retrieval, ingest, and the MCP orchestrator at it, no re-typing.
      </p>
    </div>
    <button type="button" class="btn btn-primary" on:click={openAdd}>+ Add graph</button>
  </header>

  {#if banner}
    <p class="banner" class:banner-err={banner.kind === "err"} role="status">{banner.text}</p>
  {/if}

  {#if graphs.length === 0 && loadFailed}
    <!-- Error-as-empty fix (#289): a failed load shows an error + retry, never
         the "No graphs saved yet" empty state. -->
    <BrutalErrorBanner
      title="Couldn’t load your graphs"
      message="Something went wrong loading your saved graph stores. Your graphs are safe — this is a display error."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" on:click={refresh} disabled={refreshing}>
          {refreshing ? "Retrying…" : "Try again"}
        </button>
      {/snippet}
    </BrutalErrorBanner>
  {:else if graphs.length === 0 && !formOpen}
    <EmptyState
      title="No graphs saved yet"
      description="Save every graph store you work with. Add your first SurrealDB graph store to get started."
    >
      <button type="button" class="btn btn-primary" on:click={openAdd}>+ Add graph</button>
    </EmptyState>
  {/if}

  <ul class="graph-grid">
    {#each graphs as g (g.id)}
      <li class="graph-card" class:graph-card-active={g.is_active}>
        <div class="graph-card-top">
          <span class="graph-name">{g.label ?? connSummary(g)}</span>
          {#if g.is_active}<span class="badge badge-active">Active</span>{/if}
          <span class="badge badge-{g.status}">{g.status}</span>
        </div>
        <code class="graph-conn" title={connSummary(g)}>{connSummary(g)}</code>
        <dl class="graph-meta">
          <div>
            <dt>Domain pack</dt>
            <dd>{packTitle(g.bundle?.default_domain_pack_id) ?? "Default (generic)"}</dd>
          </div>
          {#if g.bundle?.default_stop_after_stage}
            <div>
              <dt>Stop after</dt>
              <dd>{g.bundle.default_stop_after_stage}</dd>
            </div>
          {/if}
        </dl>
        {#if g.last_error}<p class="graph-err">Last error: {g.last_error}</p>{/if}
        <div class="graph-actions">
          {#if !g.is_active}
            <button type="button" class="btn btn-primary btn-sm" on:click={() => activate(g)} disabled={busyId === g.id}>
              {busyId === g.id ? "…" : "Activate"}
            </button>
          {/if}
          <button type="button" class="btn btn-outline btn-sm" on:click={() => test(g)} disabled={busyId === g.id}>Test</button>
          <button type="button" class="btn btn-outline btn-sm" on:click={() => openEdit(g)}>Edit</button>
          <button type="button" class="btn btn-ghost btn-sm" on:click={() => remove(g)} disabled={busyId === g.id}>Delete</button>
        </div>
      </li>
    {/each}
  </ul>

  {#if formOpen}
    <form class="form graph-form card" on:submit|preventDefault={submitForm}>
      <h3 class="h3">{editingId ? "Edit graph" : "Add a graph"}</h3>
      <label class="field">
        <span class="field-label">Name</span>
        <input class="input" type="text" bind:value={fLabel} placeholder="e.g. Philosophy KG (prod)" />
      </label>
      <label class="field">
        <span class="field-label">Endpoint URL</span>
        <input class="input" type="url" bind:value={fEndpoint} placeholder="https://your-surreal-host:8000" required />
      </label>
      <div class="row">
        <label class="field">
          <span class="field-label">Namespace</span>
          <input class="input" type="text" bind:value={fNamespace} placeholder="restormel" required />
        </label>
        <label class="field">
          <span class="field-label">Database</span>
          <input class="input" type="text" bind:value={fDatabase} placeholder="knowledge" required />
        </label>
      </div>
      <div class="row">
        <label class="field">
          <span class="field-label">Username (optional)</span>
          <input class="input" type="text" bind:value={fUsername} autocomplete="off" />
        </label>
        <label class="field">
          <span class="field-label">
            Password / token
            {#if editingId}<span class="field-hint">(leave blank to keep)</span>{/if}
          </span>
          <input class="input" type="password" bind:value={fSecret} autocomplete="new-password" placeholder="••••••••" />
        </label>
      </div>
      <label class="field">
        <span class="field-label">Domain pack</span>
        <select class="input" bind:value={fPackId}>
          <option value="">Default (generic)</option>
          {#each packs as p (p.id)}
            <option value={p.id}>{p.title}</option>
          {/each}
        </select>
        <span class="field-hint">The pack carries this graph's schema/ontology. It switches in when you activate the graph.</span>
      </label>
      {#if !editingId}
        <label class="check">
          <input type="checkbox" bind:checked={fActivate} />
          <span>Make this my active graph after saving</span>
        </label>
      {/if}
      {#if formMsg}<p class="err" role="alert">{formMsg}</p>{/if}
      <div class="actions">
        <button type="submit" class="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : editingId ? "Save changes" : "Add graph"}
        </button>
        <button type="button" class="btn btn-secondary" on:click={closeForm} disabled={saving}>Cancel</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .library {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .library-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }
  .card-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    max-width: 44rem;
    margin: var(--space-2) 0 0;
  }
  .banner {
    border: var(--border-thin);
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
  }
  .banner-err {
    color: var(--rm-danger, #b00);
    border-color: color-mix(in oklab, var(--rm-danger, #b00) 40%, var(--rm-border));
  }
  .graph-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  @media (min-width: 720px) {
    .graph-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .graph-card {
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .graph-card-active {
    border-color: var(--color-ink, currentColor);
    box-shadow: inset 0 0 0 1px var(--color-ink, currentColor);
  }
  .graph-card-top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .graph-name {
    font-weight: 700;
    color: var(--rm-text);
  }
  .badge {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    padding: 0 var(--space-2);
    border: var(--border-thin);
    border-radius: var(--rm-radius);
  }
  .badge-active {
    background: var(--color-ink, #111);
    color: var(--rm-surface, #fff);
  }
  .badge-ok {
    color: var(--rm-success, #060);
  }
  .badge-error {
    color: var(--rm-danger, #b00);
  }
  .graph-conn {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .graph-meta {
    display: flex;
    gap: var(--space-4);
    margin: 0;
  }
  .graph-meta dt {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .graph-meta dd {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .graph-err {
    color: var(--rm-danger, #b00);
    font-size: var(--text-xs);
    margin: 0;
  }
  .graph-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-1);
  }
  .btn-sm {
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
  }
  .graph-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .row {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: 1fr 1fr;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .field-label {
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .field-hint {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }
  .err {
    color: var(--rm-danger, #b00);
    font-size: var(--text-sm);
  }
  .actions {
    display: flex;
    gap: var(--space-2);
  }
</style>
