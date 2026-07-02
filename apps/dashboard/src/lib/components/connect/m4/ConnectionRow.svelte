<script lang="ts">
  /**
   * M4 connections-manager row (RES-113 PR-7; copy pack §4.4, strings verbatim).
   *
   * Row anatomy: {type icon} {name} · READ / READ + WRITE · {endpoint} · Copy.
   * The `LIVE` chip renders ONLY when derived from REAL observed traffic (the
   * `live` prop — request logs attributed to this key, ingest excluded). This
   * fixes the old hardcoded-on dot, a REC-ADR-016 honesty violation: absence of
   * traffic evidence renders NOTHING, never a fabricated status.
   *
   * Delete lives in the per-row detail view (disclosure), never inline in the
   * list; the confirmation states the blast radius (copy pack §4.4 detail view).
   */
  import { createEventDispatcher, tick } from "svelte";
  import ConnectionTypeIcon from "./ConnectionTypeIcon.svelte";
  import {
    getMethod,
    connectionEndpoint,
    ACCESS_BADGE,
    type ConnectionView,
  } from "./connection-model";

  export let connection: ConnectionView;
  export let connectApiBase = "";
  /** True while a delete request for THIS connection is in flight. */
  export let deleting = false;
  /**
   * Visible delete-failure message for THIS connection (copy pack §4.5) —
   * rendered inline in the confirm block, next to its retry action (ux-contracts
   * §3 recovery floor). The manager announces it politely as well.
   */
  export let deleteError = "";
  /**
   * REAL observed traffic for this key in the last 24h (ingest excluded) —
   * the ONLY thing that renders the `LIVE` chip (REC-ADR-016).
   */
  export let live = false;

  const dispatch = createEventDispatcher<{
    delete: { keyId: string };
    /** Bubble copy feedback so the manager's persistent live region announces it. */
    announce: { text: string };
    /** Ask the manager to clear this row's stale delete error (confirm re-opened / cancelled). */
    cleardeleteerror: { keyId: string };
  }>();

  let detailOpen = false;
  let confirmingDelete = false;
  let copied = false;

  $: methodMeta = getMethod(connection.method);
  $: endpoint = connectionEndpoint({ connectApiBase, method: connection.method });
  $: detailId = `conn-detail-${connection.keyId}`;

  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(endpoint);
      copied = true;
      dispatch("announce", { text: "Copied." });
      setTimeout(() => (copied = false), 2000);
    } catch {
      copied = false;
      // Clipboard failure reaches the status region too (copy pack §4.5).
      dispatch("announce", { text: "We couldn't copy — select the text and copy it manually." });
    }
  }

  async function toggleDetail() {
    detailOpen = !detailOpen;
    if (!detailOpen) confirmingDelete = false;
  }

  async function requestDelete() {
    // A fresh confirm never shows a stale failure from an earlier attempt.
    if (deleteError) dispatch("cleardeleteerror", { keyId: connection.keyId });
    // The "Delete this connection" button is destroyed by the {#if} swap —
    // relocate focus to the safe choice (a11y skill: focus relocation on swap).
    confirmingDelete = true;
    await tick();
    document.getElementById(`${detailId}-keep`)?.focus();
  }

  async function cancelDelete() {
    if (deleteError) dispatch("cleardeleteerror", { keyId: connection.keyId });
    confirmingDelete = false;
    await tick();
    document.getElementById(`${detailId}-delete`)?.focus();
  }

  function confirmDelete() {
    dispatch("delete", { keyId: connection.keyId });
  }
</script>

<li class="conn-row">
  <div class="row-line">
    <span class="cbadge" aria-hidden="true"><ConnectionTypeIcon method={connection.method} size={20} /></span>

    <div class="cmain">
      <p class="cn">{connection.name}</p>
      <p class="cmeta">
        <code class="ep">{endpoint}</code>
      </p>
    </div>

    <span class="acl">{ACCESS_BADGE[connection.access]}</span>

    {#if live}
      <span class="clive" role="img" aria-label="This connection has served requests recently">
        <span class="ld" aria-hidden="true"></span> LIVE
      </span>
    {/if}

    <div class="row-acts">
      <button type="button" class="ibtn" on:click={copyEndpoint}>{copied ? "Copied." : "Copy"}</button>
      <button
        type="button"
        class="ibtn"
        aria-expanded={detailOpen}
        aria-controls={detailId}
        on:click={toggleDetail}
      >
        Details
      </button>
    </div>
  </div>

  {#if detailOpen}
    <div class="detail" id={detailId}>
      <dl class="detail-list">
        <div class="drow">
          <dt>Type</dt>
          <dd>{methodMeta.chip}</dd>
        </div>
        <div class="drow">
          <dt>Key</dt>
          <dd><code>{connection.keyPrefix}…</code></dd>
        </div>
        <div class="drow">
          <dt>Endpoint</dt>
          <dd><code class="ep">{endpoint}</code></dd>
        </div>
      </dl>

      {#if confirmingDelete}
        <div class="confirm" role="group" aria-label={`Delete ${connection.name}?`}>
          <p class="confirm-text">
            Delete {connection.name}? Your app loses access immediately — any code using this key
            stops working. This can't be undone.
          </p>
          {#if deleteError}
            <!-- Visible failure adjacent to its retry action (ux-contracts §3 recovery
                 floor); the manager's persistent polite region carries the announcement. -->
            <p class="delete-error">{deleteError}</p>
          {/if}
          <div class="confirm-acts">
            <button
              type="button"
              class="ibtn danger"
              id={`${detailId}-confirm`}
              disabled={deleting}
              on:click={confirmDelete}
            >
              {deleting ? "Deleting…" : "Delete connection"}
            </button>
            <button
              type="button"
              class="ibtn"
              id={`${detailId}-keep`}
              disabled={deleting}
              on:click={cancelDelete}
            >
              Keep it
            </button>
          </div>
        </div>
      {:else}
        <button type="button" class="ibtn danger" id={`${detailId}-delete`} on:click={requestDelete}>
          Delete this connection
        </button>
      {/if}
    </div>
  {/if}
</li>

<style>
  .conn-row {
    border: 2px solid var(--color-ink);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    padding: var(--space-3);
  }
  .row-line {
    display: grid;
    grid-template-columns: 40px 1fr auto auto auto;
    gap: var(--space-3);
    align-items: center;
  }
  @media (max-width: 720px) {
    .row-line {
      grid-template-columns: 40px 1fr;
      row-gap: var(--space-2);
    }
    .row-line .acl,
    .row-line .clive,
    .row-line .row-acts {
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
    background: var(--color-bg);
  }
  .clive {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-ink);
    white-space: nowrap;
    border: 1.5px solid var(--color-ink);
    padding: 5px 8px;
    background: color-mix(in srgb, var(--signal-teal) 20%, var(--color-surface));
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
    min-height: 44px;
    min-width: 44px;
    cursor: pointer;
    color: var(--color-ink);
  }
  .ibtn:focus-visible {
    outline: 2px solid var(--color-yellow);
    outline-offset: 0;
    box-shadow: 0 0 0 4px var(--color-ink);
  }
  .ibtn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .ibtn.danger {
    color: var(--brut-coral);
  }

  .detail {
    margin-top: var(--space-3);
    border-top: 2px solid var(--color-ink);
    padding-top: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-start;
  }
  .detail-list {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: 100%;
  }
  .drow {
    display: flex;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
  }
  .drow dt {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 0.04em;
    color: var(--color-ink-faint);
    min-width: 72px;
    padding-top: 2px;
  }
  .drow dd {
    margin: 0;
    word-break: break-all;
  }
  .confirm {
    border: 2px solid var(--color-ink);
    border-left: 8px solid var(--brut-coral);
    background: color-mix(in srgb, var(--brut-coral) 8%, var(--color-surface));
    padding: var(--space-3);
    width: 100%;
  }
  .confirm-text {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.5;
    max-width: 62ch;
  }
  .delete-error {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.5;
    color: var(--state-fail-fg, #b00);
    max-width: 62ch;
  }
  .confirm-acts {
    display: flex;
    gap: var(--space-2);
  }
</style>
