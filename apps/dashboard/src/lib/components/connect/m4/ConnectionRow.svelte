<script lang="ts">
  /**
   * M4 connections-manager row (RES-113 PR-E; designs/M4 Connections.html).
   * Type icon · name + type · access badge (READ / READ+WRITE) · endpoint + copy ·
   * status · delete danger-zone. Presentational: access/type are a MOCK label, the
   * endpoint is illustrative, and "live" reflects a stored key — not a real probe.
   */
  import { createEventDispatcher } from "svelte";
  import ConnectionTypeIcon from "./ConnectionTypeIcon.svelte";
  import {
    getMethod,
    getAccess,
    connectionEndpoint,
    type ConnectionView,
  } from "./connection-model";

  export let connection: ConnectionView;
  export let connectApiBase = "";
  /** True while a delete request for THIS connection is in flight. */
  export let deleting = false;

  const dispatch = createEventDispatcher<{ delete: { keyId: string } }>();

  let confirmingDelete = false;
  let copied = false;

  $: methodMeta = getMethod(connection.method);
  $: accessMeta = getAccess(connection.access);
  $: endpoint = connectionEndpoint({
    connectApiBase,
    method: connection.method,
    name: connection.name,
  });

  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(endpoint);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      copied = false;
    }
  }

  function requestDelete() {
    confirmingDelete = true;
  }
  function cancelDelete() {
    confirmingDelete = false;
  }
  function confirmDelete() {
    dispatch("delete", { keyId: connection.keyId });
  }
</script>

<li class="conn-row" class:rw={connection.access === "read_write"}>
  <span class="cbadge" aria-hidden="true"><ConnectionTypeIcon method={connection.method} size={20} /></span>

  <div class="cmain">
    <p class="cn">
      {connection.name}
      <span class="ct">{methodMeta.name}</span>
    </p>
    <p class="cmeta">
      <code>{connection.keyPrefix}…</code> · endpoint
      <code class="ep">{endpoint}</code>
    </p>
  </div>

  <span class="acl" class:ro={connection.access === "read"} class:wr={connection.access === "read_write"}>
    {accessMeta.badge}
  </span>

  <span class="clive" title="Backed by a live Gateway key">
    <span class="ld" aria-hidden="true"></span> Live
  </span>

  <div class="row-acts">
    <button type="button" class="ibtn" on:click={copyEndpoint}>{copied ? "Copied" : "Copy"}</button>
    {#if confirmingDelete}
      <button type="button" class="ibtn" on:click={cancelDelete} disabled={deleting}>Cancel</button>
      <button type="button" class="ibtn danger" on:click={confirmDelete} disabled={deleting}>
        {deleting ? "Deleting…" : "Confirm delete"}
      </button>
    {:else}
      <button type="button" class="ibtn danger" on:click={requestDelete} aria-label={`Delete connection ${connection.name}`}>
        Delete
      </button>
    {/if}
  </div>
</li>

<style>
  .conn-row {
    display: grid;
    grid-template-columns: 40px 1fr auto auto auto;
    gap: var(--space-3);
    align-items: center;
    border: 2px solid var(--color-ink);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    padding: var(--space-3);
  }
  @media (max-width: 720px) {
    .conn-row {
      grid-template-columns: 40px 1fr;
      row-gap: var(--space-2);
    }
    .conn-row .acl,
    .conn-row .clive,
    .conn-row .row-acts {
      grid-column: 2;
      justify-self: start;
    }
  }
  .cbadge {
    width: 40px;
    height: 40px;
    border: 2px solid var(--color-ink);
    display: grid;
    place-items: center;
    background: var(--color-bg);
  }
  .conn-row.rw .cbadge {
    background: color-mix(in srgb, var(--signal-teal) 20%, var(--color-surface));
  }
  .cmain {
    min-width: 0;
  }
  .cn {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 1.1rem;
    text-transform: uppercase;
    line-height: 1;
  }
  .ct {
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink-faint);
    margin-left: var(--space-2);
  }
  .cmeta {
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-ink-faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cmeta .ep {
    color: var(--color-ink-muted);
  }
  .acl {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: 1.5px solid var(--color-ink);
    padding: 5px 8px;
    white-space: nowrap;
  }
  .acl.ro {
    background: var(--color-bg);
  }
  .acl.wr {
    background: color-mix(in srgb, var(--signal-teal) 20%, var(--color-surface));
  }
  .clive {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--signal-teal);
    white-space: nowrap;
  }
  .clive .ld {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--signal-teal);
    border: 1.5px solid var(--color-ink);
  }
  .row-acts {
    display: flex;
    gap: var(--space-1);
  }
  .ibtn {
    border: 2px solid var(--color-ink);
    background: var(--color-surface);
    box-shadow: 2px 2px 0 var(--color-ink);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 7px 9px;
    cursor: pointer;
    color: var(--color-ink);
  }
  .ibtn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .ibtn.danger {
    color: var(--brut-coral);
  }
</style>
