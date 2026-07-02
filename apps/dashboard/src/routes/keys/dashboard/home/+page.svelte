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
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import TrustSparkline from "./TrustSparkline.svelte";
  import { isActiveIngestJobStatus } from "$lib/connect/connect-journey";
  import {
    deriveHomeState,
    type HomeStateKind,
    type HomeStateSignals,
  } from "$lib/connect/home-state";
  import { journeyStageName } from "$lib/connect/stage-vocabulary";
  import { invalidateAll, goto } from "$app/navigation";
  import {
    ANSWER_CONSOLE_HREF,
    CLAIMS_MEMORY_HREF,
    CONNECT_HUB_HREF,
    INGEST_FLOW_HREF,
    RUNS_HREF,
    VERIFY_HREF,
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
  import type {
    ConnectCompletionSignals,
    ConnectReadinessSummary,
    HomeActivityRow,
  } from "./+page.server";

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
    /** RES-113 PR-3 (flag-ON only; null flag-OFF): graph display name for the hero. */
    graphName: string | null;
    /** RES-113 PR-3 (flag-ON only; resolves null flag-OFF): LIVE-state activity rows. */
    homeActivity: Promise<HomeActivityRow[] | null>;
    /**
     * RES-113 PR-3 (flag-ON only; false flag-OFF): real APP traffic observed in the
     * last 24h, with the pipeline's own `connect_ingest` request logs excluded —
     * the hero chip's `LIVE` signal (copy pack §1 honesty rule / REC-ADR-016).
     */
    hasAppTraffic24h: boolean;
  };

  const isFree = data.entitlements?.plan === "free";

  // RES-113 PR-3 (REC-ADR-022): the journey Home shell — a single state switch over
  // `deriveHomeState()` — supersedes the M2VerifyHub mount behind the onboarding
  // flag. Default OFF → the existing masthead below renders byte-for-byte unchanged
  // (the {:else} branch).
  $: onboardingJourney = ($page.data.moduleFlags ?? MVP_MODULE_DEFAULTS).onboardingJourney;

  // Journey-nav signals hoisted by the layout (PR-2). Flag-ON only; the extra
  // counts are null on the flag-OFF path (inert there — never read).
  $: journeyNavSignals = ($page.data.journeySignals ?? null) as {
    sourceCount: number | null;
    connectionCount: number | null;
  } | null;
  $: journeyConnectionCount = journeyNavSignals?.connectionCount ?? 0;
  $: journeySourceCount = journeyNavSignals?.sourceCount ?? null;

  /**
   * Map the streamed scorecard + hub payload onto the `deriveHomeState` signals
   * (home-state.ts, PR-2). Reveal predicates (ux-craft 2.1): the Verify ghost tile
   * renders only on `homeState.showVerifyGhost` (graph built AND flagged > 0 —
   * `resolveM2Surface` would read "triage"); the ask box mounts from BUILT onward;
   * the activity panel mounts inside LIVE only (copy pack §1).
   */
  function homeSignals(
    card: ConnectTrustScorecardData | null,
    hub: ConnectHubPayload | null,
    connectionCount: number,
  ): HomeStateSignals {
    const stats = hub?.journey.stats ?? null;
    return {
      trustScore: card?.trust_score ?? null,
      units: card?.units ?? stats?.units ?? 0,
      awaitingTriage: stats?.validation.awaiting_triage ?? 0,
      connectionCount,
      latestJob: hub?.journey.latestJob ?? null,
    };
  }

  /**
   * Hero connection chip (copy pack §1 Hero). `LIVE` renders ONLY from real
   * observed APP traffic (REC-ADR-016 honesty rule — same as Connect S2): the
   * signal is the server's ingest-EXCLUDED 24h probe (`hasAppTraffic24h`), so a
   * rebuild's own `connect_ingest` request logs can never light the chip while
   * the activity panel below honestly says "No requests yet" (5-lens review
   * fix). A mere existing connection reads `CONNECTED`.
   */
  function connectionChip(
    connectionCount: number,
    hasAppTraffic: boolean,
  ): { label: string; aria: string; live: boolean } {
    if (connectionCount > 0 && hasAppTraffic) {
      return { label: "LIVE", aria: "Live — serving answers to your app", live: true };
    }
    if (connectionCount > 0) {
      return { label: "CONNECTED", aria: "Connected — no requests served yet", live: false };
    }
    return { label: "NOT CONNECTED", aria: "Not connected — no app is using this graph yet", live: false };
  }

  /** Ask box (mounts from BUILT onward): hands the question to the Answer Console. */
  let askQuestion = "";
  function submitAsk() {
    const q = askQuestion.trim();
    if (!q) return;
    void goto(`${ANSWER_CONSOLE_HREF}?q=${encodeURIComponent(q)}`);
  }

  // Focus relocation on retry-driven swaps (a11y skill — never let focus drop to
  // <body> on a conditional swap): `invalidateAll()` hands the {#await} blocks NEW
  // promises, so everything inside them (including the old focus targets) unmounts
  // and remounts AFTER the retry handler returns. A post-hoc `.focus()` on a stale
  // bind would fire against a destroyed node (5-lens review fix). Instead the retry
  // CLAIMS a focus group, and whichever matching region next MOUNTS consumes the
  // claim and focuses itself — focus lands on the remounted content, whenever it
  // arrives. Programmatic-only targets (`tabindex="-1"`, no visible ring).
  let pendingFocus: "journey" | "activity" | null = null;
  function claimFocus(node: HTMLElement, group: "journey" | "activity") {
    if (pendingFocus === group) {
      pendingFocus = null;
      node.focus();
    }
  }

  let retryingJourney = false;
  async function retryJourney() {
    retryingJourney = true;
    pendingFocus = "journey";
    try {
      await invalidateAll();
    } finally {
      retryingJourney = false;
    }
  }

  let retryingActivity = false;
  async function retryActivity() {
    retryingActivity = true;
    pendingFocus = "activity";
    try {
      await invalidateAll();
    } finally {
      retryingActivity = false;
    }
  }

  // ── RES-113 PR-3: persistent journey status region (flag-ON only) ─────────
  // The a11y skill requires live regions to be persistent — a `role="status"`
  // born inside an {#await}/{#if} branch is recreated with its content and never
  // announces (5-lens review fix). One region mounts empty at boot (top of the
  // flag-ON branch, OUTSIDE every swap) and this script feeds it: the run-stage
  // line while a build is running, and the activity panel's async outcomes.
  let journeyAnnounce = "";
  /** What the status region currently carries, so the two async feeders only
   *  ever clear their OWN message — the state sync must not wipe an activity
   *  outcome announced a beat earlier (and vice versa). */
  let journeyAnnounceKind: "stage" | "activity" | null = null;
  /** The derived state kind, mirrored into script so async announcements can be
   *  scoped to the state whose panel is actually mounted (never announce the
   *  activity outcome from EMPTY, where no panel exists). */
  let journeyHomeKind: HomeStateKind | null = null;
  let journeyStateToken = 0;
  $: if (onboardingJourney) {
    syncJourneyStatus(data.scorecard, data.hub, journeyConnectionCount);
  }
  function syncJourneyStatus(
    scorecardP: Promise<ConnectTrustScorecardData | null>,
    hubP: Promise<ConnectHubPayload | null>,
    connectionCount: number,
  ) {
    const token = ++journeyStateToken;
    void Promise.all([scorecardP, hubP])
      .then(([card, hub]) => {
        if (token !== journeyStateToken) return;
        if (!hub?.journey) {
          journeyHomeKind = null;
          clearStageAnnouncement();
          return;
        }
        const home = deriveHomeState(homeSignals(card, hub, connectionCount));
        journeyHomeKind = home.kind;
        if (home.kind === "ingest_running") {
          // Copy pack §1.2: the stage line lives in a status region.
          journeyAnnounce = `${journeyStageName(home.runStage)}… usually 1–3 minutes.`;
          journeyAnnounceKind = "stage";
        } else {
          clearStageAnnouncement();
        }
      })
      .catch(() => {
        if (token !== journeyStateToken) return;
        journeyHomeKind = null;
        clearStageAnnouncement();
      });
  }
  /** Clear only a stale stage line — never an activity outcome announced a beat earlier. */
  function clearStageAnnouncement() {
    if (journeyAnnounceKind === "stage") {
      journeyAnnounce = "";
      journeyAnnounceKind = null;
    }
  }

  // ── RES-113 PR-3: activity panel async state (flag-ON only) ───────────────
  // Script-tracked (not an {#await}) so the panel can carry `aria-busy` on the
  // ONE container being swapped and announce its outcomes through the persistent
  // status region above — a plain-text swap is invisible to AT (a11y skill
  // loading-semantics row; 5-lens review fix). Token-guarded against a stale
  // promise resolving after invalidateAll handed us a new one.
  type ActivityView =
    | { kind: "loading" }
    | { kind: "error" }
    | { kind: "rows"; rows: HomeActivityRow[] };
  let activityView: ActivityView = { kind: "loading" };
  let activityToken = 0;
  $: if (onboardingJourney) trackActivity(data.homeActivity);
  function trackActivity(activityP: Promise<HomeActivityRow[] | null>) {
    const token = ++activityToken;
    activityView = { kind: "loading" };
    void activityP
      .then((rows) => {
        if (token !== activityToken) return;
        activityView = rows === null ? { kind: "error" } : { kind: "rows", rows };
        announceActivity();
      })
      .catch(() => {
        if (token !== activityToken) return;
        activityView = { kind: "error" };
        announceActivity();
      });
  }
  /** Announce the activity outcome — only while the LIVE panel is the mounted
   *  surface (copy pack §1.4 strings; "Recent activity loaded." also §1.4). */
  function announceActivity() {
    if (journeyHomeKind !== "live") return;
    if (activityView.kind === "error") {
      journeyAnnounce = "We couldn't load recent activity. Try again.";
      journeyAnnounceKind = "activity";
    } else if (activityView.kind === "rows") {
      journeyAnnounce =
        activityView.rows.length === 0
          ? "No requests yet. When your app asks a question, it shows up here."
          : "Recent activity loaded.";
      journeyAnnounceKind = "activity";
    }
  }

  /** "9m" / "2h" / "3d" from a ms-epoch timestamp (activity rows). */
  function fmtAgoFromMs(ms: number): string {
    if (!Number.isFinite(ms)) return "";
    const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return `${hrs}h`;
    return `${Math.round(hrs / 24)}d`;
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

{#if onboardingJourney}
  <!-- RES-113 PR-3: state-derived copy lives in the states below — the legacy
       operator-loop description is jargon-first for a novice (copy pack §1). -->
  <BrutalPageHeader title="Home" />
  <!-- The ONE persistent polite live region for the journey shell: rendered empty
       at boot, OUTSIDE every {#await}/{#if} swap below (a11y skill — a region born
       inside a conditional is recreated with its content and never announces).
       Fed from script: the §1.2 run-stage line + the §1.4 activity outcomes. -->
  <p class="sr-only" role="status">{journeyAnnounce}</p>
{:else}
  <BrutalPageHeader
    title="Home"
    description="One screen for the daily loop — trust, review queue, last run, and live agent traffic."
  />
{/if}

{#snippet homeAskBox(primary: boolean)}
  <!-- Ask box (copy pack §1.3): mounts from BUILT onward. Submit is secondary-styled
       in BUILT and becomes the ONE yellow primary in LIVE (Appendix A-6). Submission
       hands the question to the Answer Console (`?q=`) — the console asks it
       immediately, so the user never re-types it (WCAG 3.3.7). -->
  <div class="panel ask-box">
    {#if primary}
      <h3 class="state-headline ask-heading">Ask your graph</h3>
    {/if}
    <form class="ask-form" on:submit|preventDefault={submitAsk}>
      <label class="ask-label" for="home-ask-input">Your question</label>
      <div class="ask-row">
        <input
          id="home-ask-input"
          class="input brut-focus"
          type="text"
          bind:value={askQuestion}
        />
        <button type="submit" class="btn {primary ? 'btn-primary' : 'btn-outline'}">Ask</button>
      </div>
      <p class="ask-helper">
        Every answer comes with citations — links to the exact passages it came from.
      </p>
    </form>
  </div>
{/snippet}

{#snippet verifyGhostTile(count: number)}
  <!-- Verify ghost tile (copy pack §3.4, triage row): the SOLE M2 presence on Home.
       Reveal predicate: graph built AND flagged > 0 (`homeState.showVerifyGhost` —
       the state where `resolveM2Surface` reads "triage"). Always ghost, no dot —
       the text carries the state (Appendix A-3). -->
  <div class="panel ghost-tile">
    <p class="tile-line">
      {count === 1
        ? "1 fact couldn't be matched to a source yet."
        : `${count.toLocaleString()} facts couldn't be matched to a source yet.`}
    </p>
    <a class="tile-link brut-focus" href={VERIFY_HREF}>
      {count === 1 ? "Review 1 fact" : `Review ${count.toLocaleString()} facts`}
    </a>
  </div>
{/snippet}

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
    <!-- ── RES-113 PR-3 (REC-ADR-022): the journey Home shell ─────────────────
         ONE exhaustive switch over `deriveHomeState()` (home-state.ts). An empty
         workspace renders ONLY the M0/M1 invitation; the full M2VerifyHub no
         longer mounts on Home — its `resolveM2Surface` gate reads "hidden" on
         EMPTY, and in triage the sole M2 presence is the ghost Verify tile
         (copy pack §3.4). All strings verbatim from the copy pack (§1). -->
    {#await Promise.all([data.scorecard, data.hub])}
      <ConnectPageSkeleton variant="hub" />
    {:then [card, hub]}
      {#if !hub?.journey}
        <div class="journey-error" tabindex="-1" use:claimFocus={"journey"}>
          <BrutalErrorBanner
            title="Workspace unavailable"
            message="Could not load your workspace. Your data is unaffected — this is a load failure."
          >
            {#snippet actions()}
              <button
                type="button"
                class="btn btn-primary btn-sm"
                disabled={retryingJourney}
                on:click={retryJourney}
              >
                {retryingJourney ? "Retrying…" : "Try again"}
              </button>
            {/snippet}
          </BrutalErrorBanner>
        </div>
      {:else}
        {@const home = deriveHomeState(homeSignals(card, hub, journeyConnectionCount))}
        {@const chip = connectionChip(home.connectionCount, data.hasAppTraffic24h)}

        <!-- Persistent graph hero (copy pack §1 Hero): name + real counts + chip.
             EMPTY renders no metric row — nothing is fabricated (§2.3). -->
        <section class="graph-hero" aria-labelledby="graph-hero-h">
          <div class="hero-row">
            <h2 id="graph-hero-h" class="hero-title" tabindex="-1" use:claimFocus={"journey"}>
              {home.kind === "empty" ? "Your graph" : (data.graphName ?? "Your graph")}
            </h2>
            <span class="hero-chip" class:hero-chip--live={chip.live} role="img" aria-label={chip.aria}>
              {#if chip.live}<span class="hero-chip-dot" aria-hidden="true"></span>{/if}{chip.label}
            </span>
          </div>
          {#if home.units > 0}
            <p class="hero-metrics">
              <span>{home.units.toLocaleString()} {home.units === 1 ? "fact" : "facts"}</span>
              {#if journeySourceCount !== null}
                <span aria-hidden="true">·</span>
                <span>{journeySourceCount.toLocaleString()} {journeySourceCount === 1 ? "source" : "sources"}</span>
              {/if}
              {#if home.trustScore !== null}
                <!-- trustScore null ⇒ this segment is ABSENT (never a "—"). -->
                <span aria-hidden="true">·</span>
                <span
                  class="hero-trust"
                  title="Trust score {home.trustScore} of 100 — how strongly your answers are backed by your documents. Quoted from your trust scorecard."
                >trust score {home.trustScore}<span class="sr-only">
                    of 100 — how strongly your answers are backed by your documents. Quoted from
                    your trust scorecard.</span></span>
              {/if}
            </p>
          {/if}
        </section>

        {#if home.kind === "empty"}
          <!-- HOME · EMPTY (copy pack §1.1): hero + one sentence + one CTA. NOTHING
               else mounts — no meter, gates, triage, ledger, scorecard, activity. -->
          <section class="home-state" aria-labelledby="home-empty-h">
            <h3 id="home-empty-h" class="state-headline">
              Turn your documents into answers you can check
            </h3>
            <p class="state-body">
              Add a few documents. Restormel links the facts inside them into a graph — your
              documents, connected — so every answer can show exactly where it came from.
            </p>
            <a class="btn btn-primary" href={INGEST_FLOW_HREF}>
              Add your documents <span aria-hidden="true">→</span>
            </a>
            <p class="state-muted">Usually a few minutes from first document to first answer.</p>
          </section>
        {:else if home.kind === "ingest_running"}
          <!-- HOME · INGEST RUNNING (copy pack §1.2): one honest run-status block
               naming the real stage (shared stage table §0 — never a raw stage key). -->
          <section class="home-state" aria-labelledby="home-run-h">
            <h3 id="home-run-h" class="state-headline">Building your graph</h3>
            <!-- Visible stage line; the ANNOUNCED copy of this exact string lives in
                 the persistent status region above (copy pack §1.2 + a11y skill —
                 a role="status" born inside this {#if} branch would never announce). -->
            <p class="state-body">
              {journeyStageName(home.runStage)}… usually 1–3 minutes.
            </p>
            <a
              class="btn btn-primary"
              href={home.runJobId ? `${RUNS_HREF}/${home.runJobId}?from=home` : RUNS_HREF}
            >
              View progress <span aria-hidden="true">→</span>
            </a>
            <p class="state-muted">
              You can leave this page — we'll keep working and show progress here.
            </p>
          </section>
        {:else if home.kind === "built_not_connected"}
          <!-- HOME · BUILT, NOT CONNECTED (copy pack §1.3): next-step block + ask box
               (secondary submit) + Verify ghost tile only when flagged > 0. -->
          <section class="home-state" aria-labelledby="home-built-h">
            <h3 id="home-built-h" class="state-headline">
              Try a question, then connect your app
            </h3>
            <p class="state-body">
              Ask below to see your graph answer from your documents — then connect your app or
              AI agent so it can do the same.
            </p>
            <a class="btn btn-primary" href={CONNECT_HUB_HREF}>
              Connect your app or agent <span aria-hidden="true">→</span>
            </a>
            <p class="state-muted">Takes about two minutes — you get a key your app can use.</p>
          </section>
          {@render homeAskBox(false)}
          {#if home.showVerifyGhost}
            {@render verifyGhostTile(home.flaggedCount)}
          {/if}
        {:else}
          <!-- HOME · LIVE (copy pack §1.4): ask box promoted to primary + Verify ghost
               tile only while flagged > 0 + Connect tile (ghost) + activity panel
               (this state ONLY — moved inside LIVE per plan §3.1). -->
          {@render homeAskBox(true)}
          {#if home.showVerifyGhost}
            {@render verifyGhostTile(home.flaggedCount)}
          {/if}
          <div class="panel ghost-tile">
            <p class="tile-line">
              Connected · {home.connectionCount === 1
                ? "1 connection"
                : `${home.connectionCount.toLocaleString()} connections`}
            </p>
            <a class="tile-link brut-focus" href={CONNECT_HUB_HREF}>Manage connections</a>
          </div>
          <!-- aria-busy on the ONE container being swapped (a11y skill loading
               semantics); outcomes are announced via the persistent status region
               at the top of the flag-ON branch, fed by trackActivity() in script. -->
          <section
            class="panel activity-panel"
            aria-labelledby="home-activity-h"
            aria-busy={activityView.kind === "loading"}
          >
            <!-- Heading authored uppercase — the pack's §1.4 literal is
                 `RECENT ACTIVITY`, a short operational label (§0 / X12). -->
            <h3 id="home-activity-h" class="cell-h" tabindex="-1" use:claimFocus={"activity"}>
              RECENT ACTIVITY
            </h3>
            {#if activityView.kind === "loading"}
              <p class="state-muted" aria-hidden="true">
                Loading activity… usually a few seconds.
              </p>
            {:else if activityView.kind === "error"}
              <p class="state-muted">We couldn't load recent activity. Try again.</p>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                disabled={retryingActivity}
                on:click={retryActivity}
              >
                {retryingActivity ? "Retrying…" : "Try again"}
              </button>
            {:else if activityView.rows.length === 0}
              <p class="state-muted">
                No requests yet. When your app asks a question, it shows up here.
              </p>
            {:else}
              <ul class="activity-list">
                {#each activityView.rows as row (row.id)}
                  <li class="activity-row">
                    {row.connectionName} asked · {fmtAgoFromMs(row.createdAt)} ago
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {/if}
      {/if}
    {:catch}
      <!-- ux-contracts §3 floor: `data.hub` resolves null on failure, but the
           scorecard load can REJECT — without this branch the shell would die in
           its skeleton with no recovery action (5-lens review fix). Same error
           strings + retry as the null-hub branch above (copy pack §1.5). -->
      <div class="journey-error" tabindex="-1" use:claimFocus={"journey"}>
        <BrutalErrorBanner
          title="Workspace unavailable"
          message="Could not load your workspace. Your data is unaffected — this is a load failure."
        >
          {#snippet actions()}
            <button
              type="button"
              class="btn btn-primary btn-sm"
              disabled={retryingJourney}
              on:click={retryJourney}
            >
              {retryingJourney ? "Retrying…" : "Try again"}
            </button>
          {/snippet}
        </BrutalErrorBanner>
      </div>
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

  {#if !onboardingJourney}
    <!-- Live gateway pulse — the request console below the masthead. Flag-OFF only:
         the journey shell renders its activity panel INSIDE the LIVE state above
         (RES-113 PR-3 / plan §3.1). -->
    <section class="panel pulse-panel" aria-labelledby="pulse-h">
      <h2 id="pulse-h" class="cell-h">Recent activity</h2>
      {#if isFree && (!data.livePulse || data.livePulse.requestCount24h === 0)}
        <p class="empty-msg">No requests yet. Make your first test request to see activity here.</p>
        <a class="btn btn-primary btn-sm" href={DASHBOARD_BASE + "/sandbox"}>Try a test request →</a>
      {:else}
        <LivePulse pulse={data.livePulse} isFreeTier={isFree} />
      {/if}
    </section>
  {/if}
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

  /* ── RES-113 PR-3 — journey Home shell (flag-ON only) ─────────────────────
     Tokens only (no literals); hard borders + offset shadows per the brutalist
     skill; every interactive target ≥44px; yellow appears ONLY on the one
     primary CTA per state (.btn-primary carries its own ink border). */
  .journey-error:focus {
    /* Programmatic-only focus target (retry relocation) — no visible ring. */
    outline: none;
  }
  .graph-hero {
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    padding: var(--space-4);
    margin: 0 0 var(--space-5);
  }
  .hero-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .hero-title {
    font-family: var(--font-display);
    font-size: var(--text-display-md);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: var(--text-display-line-height);
    margin: 0;
    color: var(--color-ink);
  }
  .hero-title:focus {
    /* Programmatic-only focus target (retry relocation) — no visible ring. */
    outline: none;
  }
  .hero-chip {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    border: var(--border-thin);
    background: var(--color-surface);
    color: var(--color-ink);
    padding: 4px 10px;
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  }
  .hero-chip--live {
    background: var(--color-bg-deep);
  }
  .hero-chip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-ink);
    display: inline-block;
    margin-right: 6px;
    animation: hero-pulse 1.6s ease-in-out infinite;
  }
  @keyframes hero-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.25;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-chip-dot {
      /* Static informative fallback (X9): the solid dot + the chip TEXT carry
         the live signal — never the animation alone. */
      animation: none;
    }
  }
  .hero-metrics {
    margin: var(--space-3) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    color: var(--color-ink);
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .home-state {
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    padding: var(--space-5) var(--space-4);
    margin: 0 0 var(--space-5);
  }
  .state-headline {
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: 1;
    margin: 0 0 var(--space-3);
    color: var(--color-ink);
  }
  .state-body {
    margin: 0 0 var(--space-4);
    max-width: 46rem;
    color: var(--color-ink);
  }
  .state-muted {
    margin: var(--space-3) 0 0;
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
  }

  .ask-heading {
    margin-bottom: var(--space-3);
  }
  .ask-label {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
    margin: 0 0 var(--space-2);
  }
  .ask-row {
    display: flex;
    gap: var(--space-3);
    align-items: stretch;
    flex-wrap: wrap;
  }
  .ask-row .input {
    flex: 1 1 240px;
    width: auto;
  }
  .ask-helper {
    margin: var(--space-2) 0 0;
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
  }

  .ghost-tile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    border: var(--border-thin);
    box-shadow: none;
  }
  .tile-line {
    margin: 0;
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
  }
  .tile-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .tile-link:focus-visible {
    /* Ink-paired focus (a11y skill §Focus / WCAG 1.4.11): these text links have
       no hard border of their own, so the shared bare-yellow brut-focus ring
       would float invisibly (~1.3:1) on the cream panel. Pair it: yellow ring
       (brand focus signal) + a 2px ink band outside it so the focus boundary
       itself meets 3:1. Tokens only — no new colours. */
    outline: 2px solid var(--color-yellow);
    outline-offset: 0;
    box-shadow: 0 0 0 4px var(--color-ink);
  }
  .activity-panel .cell-h:focus {
    /* Programmatic-only focus target (retry relocation) — no visible ring. */
    outline: none;
  }
  .activity-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: var(--border);
    background: var(--color-surface);
  }
  .activity-row {
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-thin);
    min-height: 44px;
    display: flex;
    align-items: center;
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    color: var(--color-ink);
  }
  .activity-row:last-child {
    border-bottom: none;
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
