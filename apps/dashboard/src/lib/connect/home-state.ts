/**
 * Home state derivation — pure, DOM-free logic for the persistent journey landing
 * (RES-113 PR-3 / REC-ADR-022, gated behind `onboardingJourney`).
 *
 * Sibling to `make-ready-hub.ts`: the Svelte shell (`home/+page.svelte`) stays
 * presentational and switches over the ONE `HomeState` this module derives from
 * signals that ALREADY stream to Home today (per plan §3.1 — no new backend):
 *   • units / trustScore              ← the streamed scorecard (`ConnectTrustScorecardData`)
 *   • validation.awaitingTriage       ← hub graph stats (`hub.journey.stats.validation`)
 *   • hub.journey connections         ← `connectionCount`
 *   • run status                      ← `hub.journey.latestJob.status`
 *
 * REC-ADR-022 (First-run Home is minimal and state-derived) drives the four
 * states below. R3-U4's "render the full masthead unlit" is superseded for the
 * flag-ON path: an empty workspace renders only the M0/M1 invitation; M2 Verify
 * content is opt-in, surfaced (as a ghost tile only) when `awaitingTriage`/flagged
 * warrants it.
 *
 * Two honesty invariants (REC-ADR-016 — name the real state, never fabricate one):
 *
 *   1. **No fabricated "running"/"empty" placeholders.** An empty workspace is the
 *      EMPTY state, not a faked mid-run. INGEST_RUNNING is entered ONLY from a real
 *      active job status, and it carries the REAL stage name (`runStage`) so the
 *      Svelte live region announces the actual stage (a11y skill: derivation modules
 *      must expose real stage names for accessible live regions — no invented text).
 *
 *   2. **`trustScore === null` is absent, never "—".** The field is passed through
 *      as-is; the shell renders nothing (not a placeholder) when it is null.
 */

/** Active ingest job statuses (mirrors `isActiveIngestJobStatus` in connect-journey.ts). */
const ACTIVE_JOB_STATUSES = new Set(["pending", "running"]);

/**
 * The four Home states (REC-ADR-022 §Decision). A discriminated union on `kind`
 * so the Svelte shell is an exhaustive switch and every per-state field the shell
 * needs travels with the state it belongs to.
 */
export type HomeStateKind = "empty" | "ingest_running" | "built_not_connected" | "live";

/** Which Home tiles the shell should mount for a state (spine owns wayfinding; nothing else pre-empts). */
export type HomeTileId =
  /** The persistent graph hero (name, real counts, live indicator). Present in every state. */
  | "hero"
  /** The M0/M1 invitation (what a graph is + the ingest CTA). EMPTY only. */
  | "invitation"
  /** The honest run-status line naming the real stage. INGEST_RUNNING only. */
  | "run_status"
  /** The Ask/Prove box — appears once a graph exists (02_IA_AND_NAV.md), BUILT + LIVE. */
  | "ask_prove"
  /** The ghost Verify tile — ONLY when `awaitingTriage`/flagged > 0. */
  | "verify_ghost"
  /** The recent-activity panel — LIVE only (moves inside LIVE per plan §3.1). */
  | "activity";

/**
 * The canonical primary-CTA id per state (one filled primary CTA per state, plan
 * §3.1). The shell owns the literal copy (deferred to PR-1's copy pack); this
 * module owns WHICH action is primary so the two can never disagree.
 */
export type HomePrimaryCtaId =
  | "add_sources" // EMPTY → "Add your sources →"
  | "view_run" // INGEST_RUNNING → "View run →"
  | "connect_app" // BUILT_NOT_CONNECTED → "Connect your app →"
  | "ask_graph"; // LIVE → "Ask your graph"

export type HomeState = {
  kind: HomeStateKind;
  /** Tiles the shell mounts, in render order. Exhaustive per state; the shell renders exactly these. */
  tiles: HomeTileId[];
  /** The single primary CTA id for this state (one filled primary per state). */
  primaryCta: HomePrimaryCtaId;
  /**
   * Whether the ghost Verify tile shows. TRUE only when outstanding verify work
   * exists (`awaitingTriage`/flagged > 0) AND a graph is built — never on EMPTY,
   * never on a mere trust-score threshold (REC-ADR-016). Mirror of
   * `tiles.includes("verify_ghost")`, surfaced as a named boolean for the shell.
   */
  showVerifyGhost: boolean;
  /** Outstanding verify count driving the ghost tile (0 unless showVerifyGhost). */
  flaggedCount: number;
  /**
   * The real ingest stage name for the live region, e.g. "extracting", "embedding".
   * Non-null ONLY in INGEST_RUNNING (and only when the server supplied a stage).
   * Never fabricated — the shell announces exactly this (a11y live-region contract).
   */
  runStage: string | null;
  /** The active run id (INGEST_RUNNING only) so the shell can link "View run →". */
  runJobId: string | null;
  /**
   * The quoted trust score (0–100) or null when there is no graph / no score.
   * Passed through as-is: null means ABSENT, never a placeholder "—" (REC-ADR-016).
   */
  trustScore: number | null;
  /** Real unit count for the hero (0 on EMPTY). */
  units: number;
  /** Live app-connection count (drives BUILT_NOT_CONNECTED vs LIVE). */
  connectionCount: number;
};

/**
 * The signals Home already streams (plan §3.1). Every field is nullable/defaulted
 * so a surface that has not resolved a particular promise yields an HONEST state
 * (EMPTY when nothing is known) rather than a fabricated one.
 */
export type HomeStateSignals = {
  /** kg-audit trust score (0–100), or null when there is no graph to score. */
  trustScore: number | null;
  /** Idea/unit count. `> 0` ⇒ a graph is built. */
  units: number;
  /** Claims flagged by the validator with no operator verdict yet (the Verify trigger). */
  awaitingTriage: number;
  /** Live app connections / wired agents. `> 0` ⇒ LIVE. */
  connectionCount: number;
  /** The latest ingest job, or null when none has run. */
  latestJob: { id: string; status: string; currentStage?: string | null } | null;
  /** Run count — a completed run (with a built graph) distinguishes BUILT from EMPTY. */
  completedRunCount: number;
};

/** A real active ingest job is in flight. */
function isActiveJob(job: HomeStateSignals["latestJob"]): boolean {
  return job !== null && ACTIVE_JOB_STATUSES.has(job.status);
}

/**
 * Derive the single `HomeState` from the streamed signals. Pure + deterministic;
 * no persisted client state (REC-ADR-021 §5 — server-derived every render).
 *
 * State selection order (REC-ADR-022 §Decision):
 *   1. INGEST_RUNNING — a real active job is in flight (takes priority over an
 *      as-yet-unbuilt graph so a first run shows honest progress, not EMPTY).
 *   2. EMPTY          — no built graph (`units <= 0`) and no active run: the M0/M1
 *      invitation only. No meter, gates, triage, ledger, scorecard, or activity.
 *   3. LIVE           — a built graph with ≥1 live connection.
 *   4. BUILT_NOT_CONNECTED — a built graph, not yet connected.
 *
 * The Verify ghost tile is added to BUILT/LIVE ONLY when `awaitingTriage > 0`
 * (never on EMPTY, never pre-emptively) — the sole M2 presence on Home.
 */
export function deriveHomeState(signals: HomeStateSignals): HomeState {
  const units = Math.max(0, Math.round(signals.units));
  const graphBuilt = units > 0;
  const flaggedCount = Math.max(0, Math.round(signals.awaitingTriage));
  const connectionCount = Math.max(0, Math.round(signals.connectionCount));
  const activeRun = isActiveJob(signals.latestJob);

  // 1. A real active run in flight → honest progress (even before the graph exists).
  if (activeRun) {
    const job = signals.latestJob!;
    return {
      kind: "ingest_running",
      tiles: ["hero", "run_status"],
      primaryCta: "view_run",
      showVerifyGhost: false,
      flaggedCount: 0,
      // The real stage name for the live region — null (not a placeholder) when
      // the server did not supply one (REC-ADR-016: never invent a stage).
      runStage: job.currentStage ?? null,
      runJobId: job.id,
      trustScore: signals.trustScore,
      units,
      connectionCount,
    };
  }

  // 2. No built graph and no active run → EMPTY (the M0/M1 invitation only).
  if (!graphBuilt) {
    return {
      kind: "empty",
      tiles: ["hero", "invitation"],
      primaryCta: "add_sources",
      showVerifyGhost: false,
      flaggedCount: 0,
      runStage: null,
      runJobId: null,
      trustScore: signals.trustScore,
      units: 0,
      connectionCount,
    };
  }

  // A graph is built. The Verify ghost tile shows ONLY when there is outstanding
  // triage work — the single, opt-in M2 presence on Home (REC-ADR-022 §Decision-3).
  const showVerifyGhost = flaggedCount > 0;

  // 3. Built + at least one live connection → LIVE.
  if (connectionCount > 0) {
    const tiles: HomeTileId[] = ["hero", "ask_prove"];
    if (showVerifyGhost) tiles.push("verify_ghost");
    tiles.push("activity"); // the activity panel lives inside LIVE (plan §3.1)
    return {
      kind: "live",
      tiles,
      primaryCta: "ask_graph",
      showVerifyGhost,
      flaggedCount: showVerifyGhost ? flaggedCount : 0,
      runStage: null,
      runJobId: null,
      trustScore: signals.trustScore,
      units,
      connectionCount,
    };
  }

  // 4. Built, not yet connected → BUILT_NOT_CONNECTED.
  const tiles: HomeTileId[] = ["hero", "ask_prove"];
  if (showVerifyGhost) tiles.push("verify_ghost");
  return {
    kind: "built_not_connected",
    tiles,
    primaryCta: "connect_app",
    showVerifyGhost,
    flaggedCount: showVerifyGhost ? flaggedCount : 0,
    runStage: null,
    runJobId: null,
    trustScore: signals.trustScore,
    units,
    connectionCount,
  };
}
