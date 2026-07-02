<script lang="ts">
  /**
   * RES-113 PR-6b — the `/verify` (M2) page (plan §3.3; copy pack §3).
   *
   * Flag-ON only by construction: the +page.server.ts load 404s flag-OFF, so this
   * shell never renders there (byte-identity invariant untouched).
   *
   * One switch over `resolveM2SurfaceFromSpine` (make-ready-hub.ts) — the SAME
   * predicate the Home tiles consume, so the two surfaces can never disagree:
   *   • hidden  → dashed empty card + "Go to Build" (copy pack §3.1); zero gate
   *     apparatus renders pre-graph (REC-ADR-020 / REC-ADR-022).
   *   • triage  → the queue-led hub (M2VerifyHub), single primary CTA
   *     "Review the first claim" honouring the priority rule.
   *   • ready   → confirmation block + "Mark your graph ready" (M2VerifyHub).
   *   • null (spine unresolved — partial read failure) → the load-failure
   *     banner + retry, never a fabricated "ready" (REC-ADR-016).
   *
   * ux-contracts §3 states: loading (skeleton) / error (banner + one recovery
   * action) / empty (hidden card) / success (triage | ready).
   */
  import { invalidateAll } from "$app/navigation";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import ConnectPageSkeleton from "$lib/components/connect/ConnectPageSkeleton.svelte";
  import M2VerifyHub from "$lib/components/connect/m2/M2VerifyHub.svelte";
  import { BUILD_HREF } from "$lib/nav-config";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    resolveM2SurfaceFromSpine,
    type MakeReadySignals,
  } from "$lib/connect/make-ready-hub";
  import type { ConnectHubPayload } from "$lib/server/connect/connect-hub-load";
  import type { ConnectTrustScorecard as ConnectTrustScorecardData } from "@restormel/contracts";

  export let data: {
    hubSignedIn: boolean;
    hub: Promise<ConnectHubPayload | null>;
    scorecard: Promise<ConnectTrustScorecardData | null>;
  };

  /** The same scorecard+hub → MakeReadySignals mapping Home used pre-PR-3 (no re-derivation). */
  function makeReadySignals(
    card: ConnectTrustScorecardData | null,
    hub: ConnectHubPayload | null,
  ): MakeReadySignals {
    const stats = hub?.journey.stats ?? null;
    const v = stats?.validation;
    return {
      trustScore: card?.trust_score ?? null,
      lastVerifiedAt: card?.last_verified_at ?? null,
      units: card?.units ?? stats?.units ?? 0,
      embedded: card?.embedding.embedded ?? stats?.embedded ?? 0,
      evidence: card
        ? {
            bound: card.evidence.bound,
            unbound: card.evidence.unbound,
            noEvidence: card.evidence.no_evidence,
            boundPct: card.evidence.bound_pct,
          }
        : null,
      validation: {
        ok: v?.ok ?? 0,
        weak: v?.weak ?? 0,
        unsupported: v?.unsupported ?? 0,
        unvalidated: v?.unvalidated ?? 0,
        awaitingTriage: v?.awaiting_triage ?? 0,
        unsupportedUntriaged: v?.unsupported_untriaged ?? 0,
      },
    };
  }

  // Focus relocation on retry-driven swaps (a11y skill — never let focus drop to
  // <body>): the retry CLAIMS focus; whichever error region next mounts consumes
  // the claim and focuses itself (same pattern as home/+page.svelte).
  let pendingFocus = false;
  function claimFocus(node: HTMLElement) {
    if (pendingFocus) {
      pendingFocus = false;
      node.focus();
    }
  }

  let retrying = false;
  async function retry() {
    retrying = true;
    pendingFocus = true;
    try {
      await invalidateAll();
    } finally {
      retrying = false;
    }
  }
</script>

<svelte:head>
  <title>Verify – Restormel Dashboard</title>
</svelte:head>

<BrutalPageHeader title="Verify" />

{#snippet loadFailure()}
  <!-- Copy pack §1.5 (journey shell load failure): one banner, one recovery action. -->
  <div class="verify-error" tabindex="-1" use:claimFocus>
    <BrutalErrorBanner
      title="Workspace unavailable"
      message="Could not load your workspace. Your data is unaffected — this is a load failure."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
      {/snippet}
    </BrutalErrorBanner>
  </div>
{/snippet}

{#if data.hubSignedIn}
  {#await Promise.all([data.scorecard, data.hub])}
    <ConnectPageSkeleton variant="hub" />
  {:then [card, hub]}
    {#if !hub?.journey}
      {@render loadFailure()}
    {:else}
      {@const signals = makeReadySignals(card, hub)}
      {@const surface = resolveM2SurfaceFromSpine(hub.spine, signals.units > 0)}
      {#if surface === "hidden"}
        <!-- HIDDEN (copy pack §3.1): no built graph — one dashed empty card, one
             CTA into the spine. No gates, meter, or ledger pixels. -->
        <section class="verify-empty" aria-labelledby="verify-empty-h">
          <h2 id="verify-empty-h" class="empty-h">Nothing to check yet</h2>
          <p class="empty-body">
            Once your graph — your documents, connected — is built, anything we couldn't fully
            match to your documents appears here for a quick review.
          </p>
          <a class="btn btn-primary" href={BUILD_HREF}>
            Go to Build <span aria-hidden="true">→</span>
          </a>
        </section>
      {:else if surface === "triage" || surface === "ready"}
        <M2VerifyHub {surface} {signals} scorecard={data.scorecard} readiness={hub.readiness} />
      {:else}
        <!-- Spine unresolved (partial read failure): we cannot honestly say
             triage OR ready — surface the load failure, never a guess. -->
        {@render loadFailure()}
      {/if}
    {/if}
  {:catch}
    {@render loadFailure()}
  {/await}
{:else}
  <!-- Signed-out shell — same panel grammar as Home's. -->
  <section class="panel" aria-labelledby="verify-signed-out-h">
    <h2 id="verify-signed-out-h" class="cell-h">Sign in to see your workspace</h2>
    <p class="empty-msg">Your trust scorecard, review queue, and runs appear here once you sign in.</p>
    <a class="btn btn-primary btn-sm" href={DASHBOARD_BASE + "/login"}>Sign in</a>
  </section>
{/if}

<style>
  .verify-error:focus {
    /* Programmatic-only focus target (retry relocation) — no visible ring. */
    outline: none;
  }

  /* HIDDEN — the dashed empty card (plan §3.3). Tokens only; the dashed border
     is the one deliberate departure from the solid brutal border, marking
     "nothing lives here yet". */
  .verify-empty {
    border: 2px dashed var(--color-ink);
    background: var(--color-surface);
    padding: var(--space-5) var(--space-4);
    margin: 0 0 var(--space-5);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .empty-h {
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: 1;
    margin: 0;
    color: var(--color-ink);
  }

  .empty-body {
    margin: 0;
    max-width: 46rem;
    color: var(--color-ink);
  }

  /* Signed-out panel — same grammar as Home's. */
  .panel {
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    padding: var(--space-4);
    margin: 0 0 var(--space-5);
  }

  .cell-h {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    margin: 0 0 var(--space-3);
  }

  .empty-msg {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
  }
</style>
