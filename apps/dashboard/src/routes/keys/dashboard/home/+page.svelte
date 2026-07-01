<script lang="ts">
  /**
   * R3 — One Home (NS §3.3): the single masthead that retires the two-homes split,
   * the two checklists, and the two trust numbers.
   *
   * Masthead order (rubric R3-V1):
   *   1. trust cap — score numeral (quotes the scorecard service) + sparkline + last verified
   *   2. factor rails — ConnectTrustScorecard, capped (the same scorecard, no second formula)
   *   3. two-col  READY TO VERIFY (K4 readiness ledger) | INBOX
   *   4. two-col  RUNS RAIL (last run)                   | AGENT TRAFFIC
   *
   * First-run / half-configured: the unlit / partially-lit readiness ledger IS the
   * checklist (one CTA into the ingest flow). There is no separate onboarding widget.
   *
   * No new queries: every value is read from the streamed load (Pivot 1.8). The
   * `+page.server.ts` is unchanged; the W2.6 no-second-formula test stays green.
   */
  import { page } from "$app/stores";
  import LivePulse from "$lib/components/dashboard/LivePulse.svelte";
  import ConnectPageSkeleton from "$lib/components/connect/ConnectPageSkeleton.svelte";
  import ConnectVerifiedReadiness from "$lib/components/connect/ConnectVerifiedReadiness.svelte";
  import ConnectSpineLedger from "$lib/components/connect/ConnectSpineLedger.svelte";
  import ConnectGraphSwitcher from "$lib/components/connect/ConnectGraphSwitcher.svelte";
  import ConnectTrustScorecard from "$lib/components/connect/ConnectTrustScorecard.svelte";
  import M2VerifyHub from "$lib/components/connect/m2/M2VerifyHub.svelte";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import type { MakeReadySignals } from "$lib/connect/make-ready-hub";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import TrustSparkline from "./TrustSparkline.svelte";
  import { isActiveIngestJobStatus } from "$lib/connect/connect-journey";
  import { invalidateAll } from "$app/navigation";
  import {
    CLAIMS_MEMORY_HREF,
    INGEST_FLOW_HREF,
    RUNS_HREF,
  } from "$lib/nav-config";
  import {
    PROVE_LINK_CLASS,
    proveClaimsFilterHref,
    proveRunVerdictHref,
  } from "$lib/prove-it";
  import type { ConnectHubPayload, ConnectGraphPulse } from "$lib/server/connect/connect-hub-load";
  import type {
    ConnectTrustScorecard as ConnectTrustScorecardData,
    ConnectEvalVerdictEntry,
  } from "@restormel/contracts";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { ConnectCompletionSignals, ConnectReadinessSummary } from "./+page.server";

  const LOGS_AGENT_HREF = DASHBOARD_BASE + "/logs?source=agent";

  export let data: {
    workspaceId: string | null;
    projects: { id: string; name: string }[];
    projectsError?: string | null;
    entitlements:
      | {
          workspaceId: string;
          plan: "free" | "pro";
          projectLimit: number;
          monthlyRequestLimit: number;
          foundingProExpiresAt: number | null;
        }
      | null;
    usage:
      | {
          usedThisMonth: number | null;
          monthlyLimit: number;
          projectLimit: number;
          providersConnected: number;
        }
      | null;
    setup:
      | {
          workspaceCreatedAt: number;
          projectCount: number;
          projectCreatedAt: number | null;
          integrationCount: number;
          providerConnectedAt: number | null;
          gatewayKeyCount: number;
          routeCount: number;
          routeCreatedAt: number | null;
          requestCount: number;
          firstRequestAt: number | null;
        }
      | null;
    livePulse:
      | {
          requestCount24h: number;
          errorRate: number;
          p50LatencyMs: number | null;
          p95LatencyMs: number | null;
          avgLatencyMs: number | null;
          topRoute:
            | {
                routeId: string | null;
                routeName: string;
                requestCount: number;
              }
            | null;
          analyticsUnavailable: boolean;
        }
      | null;
    contextSignals: {
      noRouteCount24h: number;
      hasAnyRoutePolicyBinding: boolean;
    };
    connectCompletion: ConnectCompletionSignals;
    connectReadiness: Promise<ConnectReadinessSummary | null>;
    trustStrip: Promise<{
      trust_score: number;
      g2: { ok_pct: number };
      verification_states?: Record<string, number>;
      units: number;
      last_verified_at: string | null;
    } | null>;
    hubSignedIn: boolean;
    encryptionWarning: boolean;
    hub: Promise<ConnectHubPayload | null>;
    graphPulse: Promise<ConnectGraphPulse | null>;
    scorecard: Promise<ConnectTrustScorecardData | null>;
    qualityHistory: Promise<ConnectEvalVerdictEntry[]>;
  };

  const isFree = data.entitlements?.plan === "free";

  // RES-113 (PR-D): the M2 "Verify" make-ready hub reskins this verified-context
  // masthead behind the onboarding flag. Default OFF → the existing masthead below
  // renders byte-for-byte unchanged (the {:else} branch).
  $: onboardingJourney = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).onboardingJourney;

  /** Map the streamed scorecard + hub graph-stats onto the M2 make-ready signals. */
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

  let retryingHub = false;
  async function retryHub() {
    retryingHub = true;
    try {
      await invalidateAll();
    } finally {
      retryingHub = false;
    }
  }

  let retryingTrust = false;
  async function retryTrust() {
    retryingTrust = true;
    try {
      await invalidateAll();
    } finally {
      retryingTrust = false;
    }
  }

  /** Compact ISO date → "3 Jun 2026" — avoids importing a date library. */
  function fmtDate(iso: string | null): string {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  /** Count unverified/contradicted claims from scorecard.verification_states. */
  function reviewCount(states: Record<string, number> | undefined): number {
    if (!states) return 0;
    return (states.unverified ?? 0) + (states.contradicted ?? 0);
  }

  /** Newest verdict carrying a regression diff — the INBOX "latest regression" row. */
  function latestRegression(
    history: ConnectEvalVerdictEntry[],
  ): ConnectEvalVerdictEntry | null {
    return history.find((e) => Boolean(e.diff?.regression)) ?? null;
  }

  // W4.3: the regression → producing-verdict prove-it destination (degrades to the
  // review queue when the verdict carries no run identity — built in prove-it.ts).
  function regressionRunHref(entry: ConnectEvalVerdictEntry): string {
    const runId = entry.source === "ingest_run" ? entry.source_run_id : null;
    return proveRunVerdictHref(runId, { from: "home-inbox" });
  }

  /** Last-run outcome glyph + word (ledger-row standard — never colour-only). */
  function runGlyph(status: string): string {
    if (isActiveIngestJobStatus(status)) return "◪";
    if (status === "completed") return "■";
    if (status === "failed") return "▲";
    return "□";
  }
  /** Last-run outcome word (ledger-row standard). "completed" not "verified" —
   *  a completed run is not verified without an eval verdict (honesty minor). */
  function runWord(status: string): string {
    if (isActiveIngestJobStatus(status)) return "running";
    if (status === "completed") return "completed";
    if (status === "failed") return "failed";
    return status;
  }

  /** Relative-ish "9m" / "2h" / "3d" from an ISO timestamp. */
  function fmtAgo(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return `${hrs}h`;
    return `${Math.round(hrs / 24)}d`;
  }
</script>

<svelte:head>
  <title>Home – Restormel Dashboard</title>
</svelte:head>

<BrutalPageHeader
  title="Home"
  description="One screen for the daily loop — trust, review queue, last run, and live agent traffic."
/>

{#if data.projectsError}
  <p class="error-msg" role="alert">
    Could not load your workspace. Reload the page to try again, or contact support if the problem continues.
  </p>
{/if}

{#if data.hubSignedIn}
  {#if data.encryptionWarning}
    <p class="warn-banner" role="alert">
      <strong>Dev setup needed:</strong> <code>RESTORMEL_CREDENTIALS_ENCRYPTION_KEY</code> is missing or invalid in
      <code>apps/dashboard/.env.local</code> — saving provider keys or graph store credentials is disabled
      until you set a valid 32-byte base64 key and restart the dev server.
    </p>
  {/if}

  {#if onboardingJourney}
    <!-- RES-113 M2: the make-ready hub supersedes the verified-context masthead.
         Reuses the SAME streamed scorecard + readiness ledger + graph stats. -->
    {#await Promise.all([data.scorecard, data.hub]) then [card, hub]}
      <M2VerifyHub
        signals={makeReadySignals(card, hub)}
        scorecard={data.scorecard}
        readiness={hub?.readiness ?? null}
      />
    {/await}
  {:else}
  <!-- ── 1. Trust cap — the masthead numeral (NS §3.3 / rubric R3-V1, R3-V2) ──
       Quotes the scorecard service score — never recomputes (R3-S2). The cap is a
       brutal cap: oversized numeral, flat neon fill, zero radius, hard offset shadow. -->
  <section class="trust-cap" aria-labelledby="trust-cap-h">
    <h2 id="trust-cap-h" class="trust-cap-h">Trust</h2>
    {#await data.trustStrip}
      <div class="cap-shell cap-shell--loading" role="status" aria-live="polite" aria-label="Loading trust score">
        <BrutalLoadingState message="Reading trust scorecard…" rows={0} />
      </div>
    {:then strip}
      {#if strip}
        {@const needsReview = reviewCount(strip.verification_states)}
        <div class="cap-shell">
          <div class="cap-readout" role="group" aria-label="Trust score {strip.trust_score} out of 100">
            <span class="cap-num">{strip.trust_score}</span>
            <span class="cap-denom">/100</span>
          </div>
          <div class="cap-spark">
            {#await data.qualityHistory then history}
              <!-- X4 / NS §2.4: runsHref links the trend to its verdict-history receipt -->
            <TrustSparkline {history} runsHref={RUNS_HREF} />
            {/await}
          </div>
          <div class="cap-meta">
            <span class="cap-meta-label">Last verified</span>
            <span class="cap-meta-val">
              {strip.last_verified_at ? fmtDate(strip.last_verified_at) : "never"}
            </span>
          </div>
          {#if needsReview > 0}
            <a class="cap-review {PROVE_LINK_CLASS} brut-focus" href={proveClaimsFilterHref("review")}>
              {needsReview} need review <span class="prove-it-arrow" aria-hidden="true">↗</span>
            </a>
          {/if}
        </div>

        <!-- 2. Factor rails — the same scorecard, capped (no second numeral / formula) -->
        <ConnectTrustScorecard scorecard={data.scorecard} capped />
      {:else}
        <!-- No graph yet — invitation into the first ingest run (no dead end, R3-U5). -->
        <div class="cap-shell cap-shell--empty">
          <EmptyState
            title="No verified context yet"
            description="The trust scorecard appears after your first ingest run writes claims to the graph store. Run the pipeline to build a graph your agents can trust."
          >
            <a class="btn btn-primary btn-sm" href={INGEST_FLOW_HREF}>Start your first ingest run</a>
          </EmptyState>
        </div>
      {/if}
    {:catch}
      <!-- R3-U5: the cap error path must offer a recovery action, never swallow the number. -->
      <BrutalErrorBanner
        title="Trust scorecard unavailable"
        message="Could not read the graph store to quote your trust score. Your graph is unaffected — this is a read failure."
      >
        {#snippet actions()}
          <button type="button" class="btn btn-primary btn-sm" disabled={retryingTrust} on:click={retryTrust}>
            {retryingTrust ? "Retrying…" : "Try again"}
          </button>
          <a class="btn btn-outline btn-sm" href={INGEST_FLOW_HREF + "?step=store"}>Check graph store</a>
        {/snippet}
      </BrutalErrorBanner>
    {/await}
  </section>

  <ConnectGraphSwitcher />

  <!-- ── 3 + 4. The masthead grid — READY TO VERIFY | INBOX over RUNS | AGENT TRAFFIC ── -->
  {#await data.hub}
    <ConnectPageSkeleton variant="hub" />
  {:then hub}
    {#if !hub?.journey}
      <BrutalErrorBanner
        title="Workspace unavailable"
        message="Could not load your workspace masthead. Your data is unaffected — this is a load failure."
      >
        {#snippet actions()}
          <button type="button" class="btn btn-primary btn-sm" disabled={retryingHub} on:click={retryHub}>
            {retryingHub ? "Retrying…" : "Try again"}
          </button>
          <a class="btn btn-outline btn-sm" href={INGEST_FLOW_HREF + "?step=store"}>Check pipeline setup</a>
        {/snippet}
      </BrutalErrorBanner>
    {:else}
      {@const journey = hub.journey}
      {@const latestJob = journey.latestJob}

      <!-- Phase 2 spine: the five-stage "where am I / what's next" ledger.
           The hub is stage ①'s home, so no surface is marked active here. -->
      <ConnectSpineLedger spine={hub.spine} />

      <div class="masthead-grid">
        <!-- READY TO VERIFY — the K4 readiness ledger. The unlit/partially-lit rows
             ARE the checklist (R3-U4): one fix-forward CTA per row, no onboarding widget. -->
        <div class="masthead-cell">
          <ConnectVerifiedReadiness readiness={hub.readiness} />
        </div>

        <!-- INBOX — review count + latest regression + memory inbox link (R3-U2). -->
        <section class="masthead-cell inbox" aria-labelledby="inbox-h">
          <h2 id="inbox-h" class="cell-h">Inbox</h2>
          {#await data.scorecard then card}
            {@const review = card ? reviewCount(card.verification_states) : 0}
            <ul class="ledger" aria-label="Inbox items">
              <li class="ledger-row">
                <span class="ledger-glyph" aria-hidden="true">{review > 0 ? "◪" : "■"}</span>
                <div class="ledger-main">
                  <span class="ledger-label">Claims to review</span>
                  <span class="ledger-evidence">
                    {#if card}
                      {review} unverified or contradicted
                    {:else}
                      no graph yet — nothing to review
                    {/if}
                  </span>
                </div>
                {#if review > 0}
                  <a class="ledger-fix {PROVE_LINK_CLASS} brut-focus" href={proveClaimsFilterHref("review")}>review <span class="prove-it-arrow" aria-hidden="true">↗</span></a>
                {:else}
                  <span class="ledger-word">clear</span>
                {/if}
              </li>

              {#await data.qualityHistory then history}
                {@const reg = latestRegression(history)}
                <li class="ledger-row">
                  <span class="ledger-glyph" aria-hidden="true">{reg ? "▲" : "■"}</span>
                  <div class="ledger-main">
                    <span class="ledger-label">Latest regression</span>
                    <span class="ledger-evidence">
                      {#if reg}
                        {reg.diff?.regressions?.[0] ?? "Regression detected"} · {fmtDate(reg.recorded_at)}
                      {:else if history.length > 0}
                        no regressions in the last {history.length} verdicts
                      {:else}
                        no verdicts recorded yet
                      {/if}
                    </span>
                  </div>
                  {#if reg}
                    <a class="ledger-fix {PROVE_LINK_CLASS} brut-focus" href={regressionRunHref(reg)}>diff <span class="prove-it-arrow" aria-hidden="true">↗</span></a>
                  {:else}
                    <span class="ledger-word">clear</span>
                  {/if}
                </li>
              {/await}

              <li class="ledger-row">
                <span class="ledger-glyph" aria-hidden="true">■</span>
                <div class="ledger-main">
                  <span class="ledger-label">Memory inbox</span>
                  <!-- DEFERRED: memory-pending count has no cheap honest source without a
                       new query (W2.4). Omitted honestly — link only, no fabricated count. -->
                  <span class="ledger-evidence">approved writes promote to the graph</span>
                </div>
                <a class="ledger-fix brut-focus" href={CLAIMS_MEMORY_HREF}>open →</a>
              </li>
            </ul>
          {/await}
        </section>

        <!-- RUNS RAIL — last run outcome (R3-U2 → /runs/[id]). -->
        <section class="masthead-cell runs-rail" aria-labelledby="runs-h">
          <h2 id="runs-h" class="cell-h">Runs</h2>
          <ul class="ledger" aria-label="Run status">
            {#if latestJob}
              <li class="ledger-row">
                <span class="ledger-glyph" aria-hidden="true">{runGlyph(latestJob.status)}</span>
                <div class="ledger-main">
                  <span class="ledger-label">Last run</span>
                  <span class="ledger-evidence">
                    {runWord(latestJob.status)}
                    {#if latestJob.updatedAt} · {fmtAgo(latestJob.updatedAt)} ago{/if}
                    {#if latestJob.label} · {latestJob.label}{/if}
                  </span>
                </div>
                <a class="ledger-fix brut-focus" href={`${RUNS_HREF}/${latestJob.id}?from=home`}>open →</a>
              </li>
              <!-- W3.6 changed-source chip mounts here once the load can answer
                   "sources changed since last run" — its data is NOT in this load,
                   so the chip is a comment-marked mount point (no fabricated count). -->
            {:else}
              <li class="ledger-row">
                <span class="ledger-glyph" aria-hidden="true">□</span>
                <div class="ledger-main">
                  <span class="ledger-label">Last run</span>
                  <span class="ledger-evidence">no ingest run yet</span>
                </div>
                <a class="ledger-fix brut-focus" href={INGEST_FLOW_HREF}>ingest →</a>
              </li>
            {/if}
          </ul>
        </section>

        <!-- AGENT TRAFFIC — gateway requests in 24h → /logs?source=agent. -->
        <section class="masthead-cell agent-traffic" aria-labelledby="agent-h">
          <h2 id="agent-h" class="cell-h">Agent traffic</h2>
          <ul class="ledger" aria-label="Agent traffic">
            <li class="ledger-row">
              <span class="ledger-glyph" aria-hidden="true">{(data.livePulse?.requestCount24h ?? 0) > 0 ? "■" : "□"}</span>
              <div class="ledger-main">
                <!-- Honest label: count is all gateway requests, not verified answers -->
                <span class="ledger-label">Gateway requests · 24h</span>
                <span class="ledger-evidence">
                  {#if data.livePulse?.analyticsUnavailable}
                    analytics unavailable — count not measured
                  {:else}
                    {(data.livePulse?.requestCount24h ?? 0).toLocaleString()} gateway requests
                  {/if}
                </span>
              </div>
              <a class="ledger-fix brut-focus" href={LOGS_AGENT_HREF}>logs →</a>
            </li>
          </ul>
        </section>
      </div>
    {/if}
  {:catch}
    <BrutalErrorBanner
      title="Workspace unavailable"
      message="Could not load your workspace masthead. Your data is unaffected — this is a load failure."
    >
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" disabled={retryingHub} on:click={retryHub}>
          {retryingHub ? "Retrying…" : "Try again"}
        </button>
        <a class="btn btn-outline btn-sm" href={INGEST_FLOW_HREF + "?step=store"}>Check pipeline setup</a>
      {/snippet}
    </BrutalErrorBanner>
  {/await}
  {/if}

  <!-- Live gateway pulse — the request console below the masthead. -->
  <section class="panel pulse-panel" aria-labelledby="pulse-h">
    <h2 id="pulse-h" class="cell-h">Recent activity</h2>
    {#if isFree && (!data.livePulse || data.livePulse.requestCount24h === 0)}
      <p class="empty-msg">No requests yet. Make your first test request to see activity here.</p>
      <a class="btn btn-primary btn-sm" href={DASHBOARD_BASE + "/sandbox"}>Try a test request →</a>
    {:else}
      <LivePulse pulse={data.livePulse} isFreeTier={isFree} />
    {/if}
  </section>
{:else}
  <!-- Signed-out shell: W4.6 owns the redirect decision; here we offer a next action. -->
  <section class="panel" aria-labelledby="signed-out-h">
    <h2 id="signed-out-h" class="cell-h">Sign in to see your workspace</h2>
    <p class="empty-msg">Your trust scorecard, review queue, and runs appear here once you sign in.</p>
    <a class="btn btn-primary btn-sm" href={DASHBOARD_BASE + "/login"}>Sign in</a>
  </section>
{/if}

<style>
  .error-msg {
    color: var(--coral-alert, #e05533);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }

  /* ── Trust cap ─────────────────────────────────────────────────────────── */
  .trust-cap {
    margin: 0 0 var(--space-5);
  }
  .trust-cap-h {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    margin: 0 0 var(--space-3);
  }
  .cap-shell {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-5);
    border: var(--border);
    background: var(--brut-neon, var(--color-yellow));
    box-shadow: var(--shadow-md);
    padding: var(--space-3) var(--space-4);
    margin: 0 0 var(--space-4);
  }
  .cap-shell--loading,
  .cap-shell--empty {
    background: var(--color-surface);
    display: block;
    padding: 0;
    border: none;
    box-shadow: none;
  }
  .cap-readout {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
  }
  .cap-num {
    font-family: var(--font-display);
    font-size: var(--text-3xl);
    font-weight: 900;
    line-height: 1;
    color: var(--color-ink);
  }
  .cap-denom {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink);
    opacity: 0.7;
  }
  .cap-spark {
    color: var(--color-ink);
  }
  .cap-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .cap-meta-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink);
    opacity: 0.7;
  }
  .cap-meta-val {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
  }
  .cap-review {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 2px;
    border: var(--border-thin);
    padding: 2px var(--space-2);
    white-space: nowrap;
    /* W4.5 a11y: ≥44px target (X10) — inline-flex centres the label in the box. */
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }

  /* ── Masthead grid — two columns, two rows (NS §3.3) ───────────────────── */
  .masthead-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
    margin: 0 0 var(--space-5);
  }
  @media (min-width: 820px) {
    .masthead-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .masthead-cell {
    min-width: 0;
  }

  .cell-h {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    margin: 0 0 var(--space-3);
  }

  /* INBOX / RUNS / AGENT TRAFFIC share the ledger-row standard (NS §3.2). */
  .inbox,
  .runs-rail,
  .agent-traffic {
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    padding: var(--space-4);
  }
  .ledger {
    list-style: none;
    margin: 0;
    padding: 0;
    border: var(--border);
    background: var(--color-surface);
  }
  .ledger-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-thin);
    min-height: 44px;
  }
  .ledger-row:last-child {
    border-bottom: none;
  }
  .ledger-glyph {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    line-height: 1;
    color: var(--color-ink);
  }
  .ledger-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .ledger-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-ink);
  }
  .ledger-evidence {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    line-height: 1.4;
  }
  .ledger-fix {
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
  .ledger-word {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink-muted);
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    .ledger-row {
      grid-template-columns: auto 1fr;
    }
    .ledger-fix,
    .ledger-word {
      grid-column: 2;
      justify-self: start;
      min-height: 32px;
    }
  }

  /* ── Live pulse + signed-out panels ────────────────────────────────────── */
  .panel {
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    padding: var(--space-4);
    margin: 0 0 var(--space-5);
  }
  .empty-msg {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
  }
  .warn-banner {
    border: var(--border-thin);
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
    padding: var(--space-3) var(--space-4);
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
</style>
