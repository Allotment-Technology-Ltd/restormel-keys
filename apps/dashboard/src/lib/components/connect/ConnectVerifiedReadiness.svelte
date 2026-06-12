<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    CONNECT_READINESS_ANCHOR,
    readinessChipLabel,
    type ConnectReadinessRow,
    type ConnectVerifiedReadiness,
  } from "$lib/connect/verified-readiness";

  /**
   * K4 — "Ready to verify": the standing readiness ledger on the Connect hub.
   * Every row is a receipt (mono evidence + fix link); the same rows gate the
   * launch preflight and explain run failures, so "ready" here and "runnable"
   * in the wizard can never disagree (review §3).
   *
   * Null = server compute failed while signed in → error state with recovery
   * actions (ux-contracts §3), never a silent blank.
   */
  export let readiness: ConnectVerifiedReadiness | null;

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";

  let retrying = false;
  async function retry() {
    retrying = true;
    try {
      await invalidateAll();
    } finally {
      retrying = false;
    }
  }

  function glyph(status: ConnectReadinessRow["status"]): string {
    return status === "ok" ? "■" : status === "warn" ? "◪" : "□";
  }

  function statusWord(status: ConnectReadinessRow["status"]): string {
    return status === "ok" ? "ready" : status === "warn" ? "check" : "fix";
  }

  function fmtTime(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
</script>

<section
  class="ready-panel"
  id={CONNECT_READINESS_ANCHOR}
  aria-labelledby="verified-readiness-heading"
>
  <div class="ready-head">
    <h2 id="verified-readiness-heading" class="ready-heading">Ready to verify</h2>
    {#if readiness}
      <span
        class="ready-chip ready-chip--{readiness.status}"
        aria-label="{readiness.ready} of {readiness.total} readiness checks pass"
      >
        {readiness.ready}/{readiness.total} ready
      </span>
    {/if}
  </div>

  {#if !readiness}
    <BrutalErrorBanner
      title="Readiness unavailable"
      message="Could not compute your Connect readiness ledger. Your setup is unaffected — this is a read failure."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
        <a class="btn btn-outline btn-sm" href={CONNECT_BASE + "/pipeline?step=launch"}>
          Open launch preflight
        </a>
      {/snippet}
    </BrutalErrorBanner>
  {:else}
    <BrutalCard fill="white">
      <p class="ready-lead">
        Will your next Connect run produce verified context? Same checks as the launch
        preflight — fix a row here and the run gate flips with it.
      </p>
      <ul class="ready-rows">
        {#each readiness.rows as row (row.id)}
          <li class="ready-row ready-row--{row.status}">
            <span class="ready-glyph ready-glyph--{row.status}" aria-hidden="true">
              {glyph(row.status)}
            </span>
            <div class="ready-main">
              <span class="ready-label">{row.label}</span>
              <span class="ready-evidence">{row.evidence}</span>
            </div>
            <span class="ready-status ready-status--{row.status}">{statusWord(row.status)}</span>
            {#if row.fixHref && row.fixLabel}
              <a class="ready-fix brut-focus" href={row.fixHref}>{row.fixLabel} →</a>
            {:else}
              <span class="ready-fix-spacer" aria-hidden="true"></span>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="ready-footnote">
        Checked {fmtTime(readiness.checkedAt)} · the launch gate and run-failure
        explanations consume these same rows.
      </p>
    </BrutalCard>
  {/if}
</section>

<style>
  .ready-panel {
    margin: 0 0 var(--space-5);
    scroll-margin-top: var(--space-6);
  }

  .ready-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-3);
    margin: 0 0 var(--space-3);
  }

  .ready-heading {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    margin: 0;
  }

  .ready-chip {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    border: var(--border);
    padding: 1px var(--space-2);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .ready-chip--ok {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
  }

  .ready-chip--warn {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
  }

  .ready-chip--fail {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
  }

  .ready-lead {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--color-ink-muted);
  }

  .ready-rows {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
    border: var(--border);
    background: var(--color-surface);
  }

  .ready-row {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-thin);
    min-height: 44px;
  }

  .ready-row:last-child {
    border-bottom: none;
  }

  .ready-row--fail {
    background: color-mix(in oklab, var(--state-fail-bg) 35%, var(--color-surface));
  }

  .ready-row--warn {
    background: color-mix(in oklab, var(--state-warn-bg) 30%, var(--color-surface));
  }

  .ready-glyph {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    line-height: 1;
  }

  .ready-glyph--ok {
    color: var(--color-ink);
  }

  .ready-glyph--warn {
    color: var(--state-warn-fg);
  }

  .ready-glyph--fail {
    color: var(--state-fail-fg);
  }

  .ready-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .ready-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .ready-evidence {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    line-height: 1.4;
  }

  .ready-status {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: var(--border-thin);
    padding: 1px var(--space-2);
    white-space: nowrap;
  }

  .ready-status--ok {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
  }

  .ready-status--warn {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
  }

  .ready-status--fail {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
  }

  .ready-fix {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }

  .ready-fix-spacer {
    display: inline-block;
  }

  .ready-footnote {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .ready-row {
      grid-template-columns: auto 1fr;
    }
    .ready-status {
      grid-column: 2;
      justify-self: start;
    }
    .ready-fix {
      grid-column: 2;
      min-height: 32px;
    }
  }
</style>
