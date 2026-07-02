<script lang="ts">
  /**
   * M2 "Verify" hub (RES-113 PR-6 — copy pack §3.2/§3.3, plan §3.3).
   *
   * Queue-led reshape of the PR-D make-ready shell, driven by `resolveM2Surface`:
   * the parent mounts this ONLY in `triage` or `ready` (in `hidden` the surface
   * renders zero pixels — the `/verify` route shows its own empty card instead).
   * All strings verbatim from the copy pack (§3); decisions (which gate leads,
   * what collapses, the honest headline count) live in `buildVerifyTriageModel`
   * (make-ready-hub.ts) so they stay pure and unit-tested.
   *
   * Visual-lens fixes carried from plan §3.3 / copy pack Appendix A-3:
   *   • no status dot duplicating status text — the words carry the state;
   *   • auto-cleared gates collapse to ONE combined receipt line (no checklist
   *     beside the CTA); only the lead gate (priority rule: pipeline order —
   *     Sources, then Searchable, then Review) renders expanded;
   *   • the full scorecard + K4 ledger sit behind ONE closed-by-default muted
   *     text disclosure ("Show the full scorecard").
   *
   * Honesty (REC-ADR-016): the headline count is real work needing the user;
   * when nothing does but a gate is still running, the surface is a QUIET
   * "Building your graph" state (no yellow primary — copy pack §0 allows a
   * primary-less steady state), never a fabricated "0 facts need your review".
   *
   * Flag-gated by construction: only `/verify` (flag-ON route) mounts this.
   */
  import ConnectTrustScorecard from "$lib/components/connect/ConnectTrustScorecard.svelte";
  import ConnectVerifiedReadiness from "$lib/components/connect/ConnectVerifiedReadiness.svelte";
  import type { ConnectTrustScorecard as ConnectTrustScorecardData } from "@restormel/contracts";
  import type { ConnectVerifiedReadiness as ConnectVerifiedReadinessData } from "$lib/connect/verified-readiness";
  import { CLAIMS_HREF, HOME_HREF } from "$lib/nav-config";
  import { proveClaimsFilterHref } from "$lib/prove-it";
  import { journeyStageName } from "$lib/connect/stage-vocabulary";
  import {
    buildVerifyTriageModel,
    type MakeReadyGateId,
    type MakeReadySignals,
  } from "$lib/connect/make-ready-hub";

  /** `triage` | `ready` — resolved by the caller via `resolveM2Surface` (never `hidden` here). */
  export let surface: "triage" | "ready";
  /** The same honest signals the scorecard + ledger + stamping desk already load. */
  export let signals: MakeReadySignals;
  /** Streamed scorecard → the disclosure's factor rails. Null when no graph to score yet. */
  export let scorecard: Promise<ConnectTrustScorecardData | null>;
  /** The K4 readiness ledger (null = read failure → the panel shows its own error). */
  export let readiness: ConnectVerifiedReadinessData | null = null;
  /** Deep-link to the triage queue (the Review gate / stamping desk surface). */
  export let triageHref: string = proveClaimsFilterHref("review");
  /** Where "Mark your graph ready" returns to (copy pack §3.3: Home). */
  export let markReadyHref: string = HOME_HREF;

  /** Copy pack §3 gate table — mono operational names (X12) + one-liners. */
  const GATE_LABEL: Record<MakeReadyGateId, string> = {
    sources: "SOURCES",
    embed: "SEARCHABLE",
    validate: "REVIEW",
  };
  const GATE_SENTENCE_NAME: Record<MakeReadyGateId, string> = {
    sources: "Sources",
    embed: "Searchable",
    validate: "Review",
  };
  const GATE_ONE_LINER: Record<MakeReadyGateId, string> = {
    sources: "Every fact needs a source.",
    embed: "Every fact needs to be findable when you ask.",
    validate: "Facts we weren't sure about need your verdict.",
  };

  $: triage = surface === "triage" ? buildVerifyTriageModel(signals) : null;

  /** Disclosure open state — closed by default; the body mounts only when open. */
  let scorecardOpen = false;

  const num = (n: number) => Math.max(0, Math.round(n)).toLocaleString();

  /** The single primary CTA opens the LEAD gate's fix surface (priority rule). */
  function leadHref(id: MakeReadyGateId): string {
    if (id === "sources") return CLAIMS_HREF + "?focus=sources";
    return triageHref;
  }

  /**
   * ONE combined receipt line for the auto-cleared gates (copy pack §3.2 /
   * Appendix A-3). The canonical two-gate pair keeps the pack's literal line;
   * other combinations use the pack's single-gate template, joined.
   */
  function clearedLine(ids: MakeReadyGateId[]): string | null {
    if (ids.length === 0) return null;
    if (ids.length === 2 && ids.includes("sources") && ids.includes("embed")) {
      return "Sources and searchability checked automatically — nothing needed from you.";
    }
    const names = ids.map((id) => GATE_SENTENCE_NAME[id]).join(" and ");
    return `${names} checked automatically — nothing needed from you.`;
  }

  /**
   * Honest stage line for a still-running collapsed gate, in the copy pack's
   * §1.2 stage grammar ("{Stage name} — {done} of {total} {units}.") — never
   * the engineering receipt ("vectorised" is banned vocabulary, ux-craft §5).
   */
  function workingLine(id: MakeReadyGateId): string {
    if (id === "embed") {
      return `${journeyStageName("embedding")} — ${num(signals.embedded)} of ${num(signals.units)} facts.`;
    }
    if (id === "sources") {
      return "Reading source links…";
    }
    return `${journeyStageName(null)}…`;
  }
</script>

<section class="verify-hub" aria-labelledby="verify-hub-h" data-testid="m2-verify-hub">
  {#if surface === "triage" && triage}
    {#if signals.trustScore !== null}
      <!-- Trust line quotes the scorecard (W2.3 single source) — absent, never "—",
           when there is no score yet (copy pack §0 / §3.2). -->
      <p class="trust-line" data-testid="verify-trust-line">
        Trust score {signals.trustScore} of 100 — how strongly your answers are backed by your
        documents.
      </p>
    {/if}

    {#if triage.needsUserCount > 0}
      <h2 id="verify-hub-h" class="verify-h">
        {triage.needsUserCount === 1
          ? "1 fact needs your review"
          : `${num(triage.needsUserCount)} facts need your review`}
      </h2>
      <!-- First contact for "claim" — defined inline (copy pack §3.2 / noun ramp A-10). -->
      <p class="verify-body">
        Each one is a claim — a fact we found in your documents — that we couldn't fully match to
        its source.
      </p>
      <p class="verify-body">
        Check each claim against the passage shown. It usually takes under a minute each.
      </p>

      {#if triage.multipleNeedYou && triage.leadGateId}
        <!-- Priority rule (copy pack §3 lead-in): only when 2+ gates need attention. -->
        <p class="verify-body verify-priority" data-testid="verify-priority">
          Start with {GATE_SENTENCE_NAME[triage.leadGateId]} — each check depends on the one
          before it, so this one comes first.
        </p>
      {/if}

      {#if triage.leadGateId}
        <!-- The ONE expanded gate (never more than one — priority rule). No chip,
             no dot: the label + words carry the state. -->
        <div class="gate-card" data-testid="verify-lead-gate" data-gate={triage.leadGateId}>
          <h3 class="gate-label">{GATE_LABEL[triage.leadGateId]}</h3>
          <p class="gate-liner">{GATE_ONE_LINER[triage.leadGateId]}</p>
          {#if triage.leadDetail}
            <p class="gate-detail">{triage.leadDetail}</p>
          {/if}
        </div>
      {/if}

      {#if clearedLine(triage.clearedGateIds)}
        <!-- ONE combined receipt line for the auto-cleared gates (A-3). -->
        <p class="receipt-line" data-testid="verify-receipt">
          {clearedLine(triage.clearedGateIds)}
        </p>
      {/if}
      {#each triage.workingGateIds as id (id)}
        <p class="receipt-line">{workingLine(id)}</p>
      {/each}
      {#each triage.queuedGates as g (g.id)}
        <!-- A later gate that also needs the user — honest receipt; the lead-in
             above already says it comes after the lead gate. -->
        <p class="receipt-line">{GATE_SENTENCE_NAME[g.id]} — {g.detail}.</p>
      {/each}

      <a class="btn btn-primary verify-cta" href={leadHref(triage.leadGateId ?? "validate")} data-testid="verify-cta">
        Review the first claim <span aria-hidden="true">→</span>
      </a>
    {:else}
      <!-- Verify work outstanding but NOTHING needs the user (e.g. still making the
           graph searchable). Quiet state — honest stage line, no yellow primary
           (copy pack §0: a steady state may earn none). -->
      <h2 id="verify-hub-h" class="verify-h">Building your graph</h2>
      {#if triage.workingGateIds.length > 0}
        {#each triage.workingGateIds as id (id)}
          <p class="verify-body">{workingLine(id)}</p>
        {/each}
      {:else}
        <p class="verify-body">{journeyStageName(null)}… usually 1–3 minutes.</p>
      {/if}
      {#if clearedLine(triage.clearedGateIds)}
        <p class="receipt-line">{clearedLine(triage.clearedGateIds)}</p>
      {/if}
    {/if}
  {:else}
    <!-- READY (copy pack §3.3): confirmation block + "Mark your graph ready". -->
    <h2 id="verify-hub-h" class="verify-h">Everything checks out</h2>
    <p class="verify-body" data-testid="verify-ready-body">
      {signals.units === 1
        ? "All 1 fact is matched to sources, searchable, and reviewed. Your graph is ready for real questions."
        : `All ${num(signals.units)} facts are matched to sources, searchable, and reviewed. Your graph is ready for real questions.`}
    </p>
    <a class="btn btn-primary verify-cta" href={markReadyHref} data-testid="verify-mark-ready">
      Mark your graph ready <span aria-hidden="true">→</span>
    </a>
    <p class="verify-muted">This records the graph as reviewed and takes you back to Home.</p>
  {/if}

  <!-- The full scorecard + K4 ledger behind ONE closed-by-default muted text
       disclosure (copy pack §3.2/§3.3 + A-3) — visually subordinate to the CTA.
       The body renders only once opened, so the closed state carries zero
       scorecard/ledger DOM (and no hidden second CTA can leak into the state). -->
  <details class="scorecard-disclosure" data-testid="verify-disclosure" bind:open={scorecardOpen}>
    <summary class="disclosure-summary">Show the full scorecard</summary>
    {#if scorecardOpen}
      <div class="disclosure-body">
        <ConnectTrustScorecard {scorecard} capped />
        <ConnectVerifiedReadiness {readiness} />
      </div>
    {/if}
  </details>
</section>

<style>
  .verify-hub {
    margin: 0 0 var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .trust-line {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }

  .verify-h {
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: 1;
    margin: 0;
    color: var(--color-ink);
  }

  .verify-body {
    margin: 0;
    max-width: 46rem;
    color: var(--color-ink);
  }

  .verify-priority {
    font-weight: 700;
  }

  .verify-muted {
    margin: 0;
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
  }

  .gate-card {
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    align-self: stretch;
  }

  .gate-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 800;
    letter-spacing: 0.04em;
    margin: 0;
    color: var(--color-ink);
  }

  .gate-liner {
    margin: 0;
    color: var(--color-ink);
  }

  .gate-detail {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }

  .receipt-line {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }

  .verify-cta {
    margin-top: var(--space-2);
  }

  .scorecard-disclosure {
    align-self: stretch;
    margin-top: var(--space-3);
  }

  .disclosure-summary {
    /* Muted text toggle (copy pack §3.2) — subordinate to the primary CTA, but
       still a ≥44px target with an ink-paired focus ring (a11y skill: the bare
       yellow ring floats invisibly on cream without an ink band). The native
       disclosure triangle + the words carry the open/closed state — never
       colour alone. */
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    cursor: pointer;
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
    text-decoration: underline;
    text-underline-offset: 2px;
    width: fit-content;
  }

  .disclosure-summary::before {
    /* Explicit open/closed glyph (glyph + word, never colour/position alone):
       `display: inline-flex` suppresses the native ::marker triangle in
       WebKit/Blink, so we restore an equivalent. */
    content: "▸";
    font-family: var(--font-mono);
    margin-right: var(--space-2);
  }

  .scorecard-disclosure[open] .disclosure-summary::before {
    content: "▾";
  }

  .disclosure-summary:focus-visible {
    outline: 2px solid var(--color-yellow);
    outline-offset: 0;
    box-shadow: 0 0 0 4px var(--color-ink);
  }

  .disclosure-body {
    margin-top: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
</style>
