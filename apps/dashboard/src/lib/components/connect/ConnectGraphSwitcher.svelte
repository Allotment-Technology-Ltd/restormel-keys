<script lang="ts">
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { ConnectGraphTarget } from "@restormel/contracts/connect";

  const API = DASHBOARD_BASE + "/api/connect/graph-library";
  const LIBRARY_HREF = DASHBOARD_BASE + "/connect/library";

  let graphs: ConnectGraphTarget[] = [];
  let loaded = false;
  let switching = false;
  let msg: string | null = null;

  $: active = graphs.find((g) => g.is_active) ?? null;

  function summary(g: ConnectGraphTarget): string {
    if (g.provider === "postgres" && g.use_dashboard_database) return "Workspace Neon database";
    const ns = g.connection.namespace;
    const db = g.connection.database;
    return g.label ?? (ns && db ? `${ns}/${db}` : g.connection.endpoint ?? g.provider);
  }

  async function load() {
    try {
      const res = await fetch(API);
      if (res.ok) {
        const d = await res.json();
        graphs = d.graphs ?? [];
      }
    } catch {
      // non-fatal — switcher just hides
    } finally {
      loaded = true;
    }
  }

  async function onSelect(e: Event) {
    const id = (e.currentTarget as HTMLSelectElement).value;
    if (!id || id === active?.id) return;
    switching = true;
    msg = null;
    try {
      const res = await fetch(`${API}/${id}/activate`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        msg = d.message ?? "Could not switch graph.";
        return;
      }
      graphs = d.graphs ?? graphs;
      // Re-run the page's loaders so the setup ledger / stats reflect the new active graph.
      await invalidateAll();
    } catch {
      msg = "Network error while switching graph.";
    } finally {
      switching = false;
    }
  }

  onMount(load);
</script>

{#if loaded && graphs.length > 0}
  <div class="switcher" aria-label="Active graph">
    <span class="switcher-label">Active graph</span>
    <div class="switcher-control">
      <label class="sr-only" for="active-graph-select">Active graph</label>
      <select
        id="active-graph-select"
        class="switcher-select"
        on:change={onSelect}
        disabled={switching}
        value={active?.id ?? ""}
      >
        {#each graphs as g (g.id)}
          <option value={g.id}>{summary(g)}{g.status === "error" ? " — ⚠" : ""}</option>
        {/each}
      </select>
      <a class="switcher-manage" href={LIBRARY_HREF}>Manage library</a>
    </div>
    {#if switching}<span class="switcher-msg" role="status">Switching…</span>{/if}
    {#if msg}<span class="switcher-msg switcher-err" role="alert">{msg}</span>{/if}
  </div>
{/if}

<style>
  .switcher {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-2) var(--space-3);
    margin: 0 0 var(--space-4);
  }
  .switcher-label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rm-muted);
  }
  .switcher-control {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1;
    min-width: 14rem;
  }
  .switcher-select {
    flex: 1;
    min-width: 12rem;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    color: var(--rm-text);
    font-size: var(--text-sm);
  }
  .switcher-manage {
    font-size: var(--text-sm);
    white-space: nowrap;
  }
  .switcher-msg {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .switcher-err {
    color: var(--rm-danger, #b00);
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
