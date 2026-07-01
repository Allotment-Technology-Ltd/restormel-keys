<script lang="ts">
  /**
   * M2 "Verify" make-ready hub (RES-113 PR-D, gated behind `onboardingJourney`).
   *
   * Reskins the existing verify surfaces — ConnectTrustScorecard (factor rails) +
   * ConnectVerifiedReadiness (the K4 ledger) + the ClaimsStampingDesk triage queue
   * — as the make-ready HUB the M0–M4 design asks for: a trust meter, three honest
   * gates (Sources · Embed · Validate), and a "mark ready" that is honestly guarded.
   *
   * This is a presentational SHELL (PR-J wires the real EBV recompute). Two honesty
   * rules it never breaks, both owned by `make-ready-hub.ts`:
   *   1. "Ready" = every claim TRIAGED, not all-green (accept-guard). Weak claims
   *      are allowed in a production-grade graph once a human has judged them.
   *   2. The trust meter shows a deferred / verified STATE (a StateChip), never an
   *      animated number climbing on its own (REC-ADR-016).
   *
   * It is additive and only ever mounts behind the flag — when the flag is OFF this
   * component is never rendered and the live verify UI is byte-for-byte unchanged.
   */
  import StateChip from "$lib/components/brutalist/StateChip.svelte";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import ConnectTrustScorecard from "$lib/components/connect/ConnectTrustScorecard.svelte";
  import ConnectVerifiedReadiness from "$lib/components/connect/ConnectVerifiedReadiness.svelte";
  import type { ConnectTrustScorecard as ConnectTrustScorecardData } from "@restormel/contracts";
  import type { ConnectVerifiedReadiness as ConnectVerifiedReadinessData } from "$lib/connect/verified-readiness";
  import { CLAIMS_HREF } from "$lib/nav-config";
  import { proveClaimsFilterHref } from "$lib/prove-it";
  import { MILESTONE_LABEL } from "$lib/connect/connect-journey";
  import {
    buildMakeReadyGates,
    buildTrustMeter,
    resolveMarkReady,
    makeReadySummary,
    type MakeReadyGate,
    type MakeReadySignals,
  } from "$lib/connect/make-ready-hub";

  /** The same honest signals the scorecard + ledger + stamping desk already load. */
  export let signals: MakeReadySignals;
  /** Streamed scorecard → the factor rails (capped). Null when no graph to score yet. */
  export let scorecard: Promise<ConnectTrustScorecardData | null>;
  /** The K4 readiness ledger (null = read failure → the panel shows its own error). */
  export let readiness: ConnectVerifiedReadinessData | null = null;
  /** Deep-link to the triage queue (the Validate gate / stamping desk surface). */
  export let triageHref: string = proveClaimsFilterHref("review");
  /** Where "Mark ready" returns to once the bar is clear (Home). */
  export let markReadyHref: string = CLAIMS_HREF;

  $: gates = buildMakeReadyGates(signals);
  $: meter = buildTrustMeter(signals);
  $: verdict = resolveMarkReady(signals);
  $: summary = makeReadySummary(signals);

  /** The Validate gate routes to triage; the others open their own detail surface. */
  function gateHref(g: MakeReadyGate): string {
    if (g.id === "validate") return triageHref;
    return CLAIMS_HREF + (g.id === "sources" ? "?focus=sources" : "?focus=embed");
  }
  function gateCta(g: MakeReadyGate): string {
    return g.needsYou ? "Open" : "View";
  }
</script>

<section class="mr-hub" aria-labelledby="mr-hub-h" data-testid="m2-verify-hub">
  <header class="mr-head">
    <div class="mr-head-titles">
      <StateChip state="running" dot={false} label={`M2 · ${MILESTONE_LABEL.m2}`} />
      <h2 id="mr-hub-h" class="mr-h">Make ready</h2>
      <p class="mr-sub">
        The home you return to — three honest gates that stand between your graph and
        production-grade. Do them in any order; the page always says what still needs you.
      </p>
    </div>
    <span class="mr-need" data-testid="mr-need">{summary.line}</span>
  </header>

  <!-- Trust meter — quoted score + a DEFERRED recompute state (no climbing number). -->
  <BrutalCard fill="white">
    <div class="mr-meter" data-testid="mr-meter">
      <div class="mr-meter-readout" role="group" aria-label="Trust score">
        <span class="mr-meter-num">{meter.score ?? "—"}</span>
        <span class="mr-meter-denom">/100</span>
      </div>
      <div class="mr-meter-state">
        <StateChip
          state={meter.recomputeState}
          label={meter.recomputeLabel}
          dot={meter.recomputeState === "running"}
        />
        <span class="mr-meter-foot">
          {#if meter.recomputeState === "running"}
            Trust recomputes once you finish triage — it doesn't climb live.
          {:else if meter.recomputeState === "done"}
            Last verified {meter.lastVerifiedAt ?? "—"}.
          {:else}
            Run an ingest to build a graph to score.
          {/if}
        </span>
      </div>
    </div>
  </BrutalCard>

  <!-- Three gates — Sources · Embed · Validate. -->
  <div class="mr-gates" role="list" aria-label="Make-ready gates">
    {#each gates as g (g.id)}
      <div class="mr-gate mr-gate--{g.state}" role="listitem" data-testid="mr-gate-{g.id}" data-state={g.state}>
        <div class="mr-gate-top">
          <h3 class="mr-gate-title">{g.title}</h3>
          <StateChip state={g.chipState} label={g.chipLabel} dot={g.chipState === "running"} />
        </div>
        <p class="mr-gate-blurb">{g.blurb}</p>
        {#if g.pct !== null}
          <div class="mr-gate-bar" role="img" aria-label="{g.pct}% complete">
            <span class="mr-gate-fill mr-gate-fill--{g.chipState}" style={`width:${g.pct}%`}></span>
          </div>
        {/if}
        <div class="mr-gate-foot">
          <span class="mr-gate-detail">{g.detail}</span>
          <a class="mr-gate-cta brut-focus" href={gateHref(g)}>{gateCta(g)} →</a>
        </div>
      </div>
    {/each}
  </div>

  <!-- Triage summary (the Validate gate's work) — honest counts, NOT a "0 weak" goal. -->
  <BrutalCard fill="white">
    <div class="mr-triage" data-testid="mr-triage">
      <div class="mr-triage-head">
        <h3 class="mr-gate-title">Triage queue</h3>
        <StateChip
          state={verdict.outstandingTriage > 0 ? "error" : "done"}
          label={verdict.outstandingTriage > 0 ? `${verdict.outstandingTriage} left` : "0 left"}
          dot={false}
        />
      </div>
      <ul class="mr-tally" aria-label="Validation tally">
        <li><span class="mr-tally-n">{signals.validation.ok}</span><span class="mr-tally-l">Supported</span></li>
        <li><span class="mr-tally-n">{signals.validation.weak}</span><span class="mr-tally-l">Weak</span></li>
        <li><span class="mr-tally-n">{signals.validation.unsupported}</span><span class="mr-tally-l">Unsupported</span></li>
      </ul>
      <p class="mr-triage-note">
        Done means every flagged claim has a verdict — not that weak or unsupported reach
        zero. A graph with honestly-weak claims can still be production-grade.
      </p>
      {#if verdict.outstandingTriage > 0}
        <a class="btn btn-primary btn-sm" href={triageHref} data-testid="mr-triage-cta">
          Review {verdict.outstandingTriage} flagged →
        </a>
      {/if}
    </div>
  </BrutalCard>

  <!-- Factor rails — the SAME scorecard, capped (no second trust number/formula). -->
  <ConnectTrustScorecard {scorecard} capped />

  <!-- The K4 readiness ledger — reused verbatim; rows are receipts with fix links. -->
  <ConnectVerifiedReadiness {readiness} />

  <!-- End state — honestly guarded by the accept-guard (triaged, not green). -->
  <div class="mr-finish">
    {#if verdict.ready}
      <a class="btn btn-primary" href={markReadyHref} data-testid="mr-mark-ready">
        Mark ready → production-grade
      </a>
    {:else}
      <button
        type="button"
        class="btn btn-primary"
        disabled
        aria-disabled="true"
        data-testid="mr-mark-ready-disabled"
      >
        Mark ready
      </button>
      <p class="mr-finish-reason" role="status">{verdict.reason}</p>
    {/if}
  </div>
</section>

<style>
  .mr-hub {
    margin: 0 0 var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .mr-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .mr-head-titles {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-width: 52ch;
  }

  .mr-h {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    margin: 0;
  }

  .mr-sub {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--color-ink-muted);
  }

  .mr-need {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: var(--border);
    padding: 2px var(--space-2);
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
    white-space: nowrap;
  }

  /* Trust meter — static numeral + a deferred-state chip. No tween. */
  .mr-meter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
    justify-content: space-between;
  }

  .mr-meter-readout {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
  }

  .mr-meter-num {
    font-family: var(--font-mono);
    font-size: 3rem;
    font-weight: 800;
    line-height: 1;
    color: var(--color-ink);
  }

  .mr-meter-denom {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    color: var(--color-ink-muted);
  }

  .mr-meter-state {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    align-items: flex-end;
    text-align: right;
  }

  .mr-meter-foot {
    font-size: var(--text-xs);
    color: var(--color-ink-muted);
    max-width: 32ch;
  }

  /* Gates */
  .mr-gates {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-3);
  }

  .mr-gate {
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-offset, 4px 4px 0 var(--color-ink));
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .mr-gate--needs_you {
    background: color-mix(in oklab, var(--state-warn-bg) 30%, var(--color-surface));
  }

  .mr-gate--needs_review {
    background: color-mix(in oklab, var(--state-fail-bg) 35%, var(--color-surface));
  }

  .mr-gate-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .mr-gate-title {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
    color: var(--color-ink);
  }

  .mr-gate-blurb {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--color-ink-muted);
  }

  .mr-gate-bar {
    height: 8px;
    border: var(--border-thin);
    background: var(--color-bg-deep);
    overflow: hidden;
  }

  .mr-gate-fill {
    display: block;
    height: 100%;
    background: var(--color-ink);
  }
  .mr-gate-fill--done {
    background: var(--state-ok-fg);
  }
  .mr-gate-fill--weak {
    background: var(--state-warn-fg);
  }
  .mr-gate-fill--error {
    background: var(--state-fail-fg);
  }
  .mr-gate-fill--running {
    background: var(--brut-amber);
  }

  .mr-gate-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-top: auto;
  }

  .mr-gate-detail {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }

  .mr-gate-cta {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
  }

  /* Triage */
  .mr-triage {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .mr-triage-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .mr-tally {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: var(--space-4);
  }

  .mr-tally li {
    display: flex;
    flex-direction: column;
  }

  .mr-tally-n {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 800;
    color: var(--color-ink);
  }

  .mr-tally-l {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink-muted);
  }

  .mr-triage-note {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.5;
    color: var(--color-ink-muted);
    max-width: 60ch;
  }

  /* Finish */
  .mr-finish {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-start;
  }

  .mr-finish-reason {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--state-warn-fg);
  }

  @media (max-width: 640px) {
    .mr-meter-state {
      align-items: flex-start;
      text-align: left;
    }
  }
</style>
