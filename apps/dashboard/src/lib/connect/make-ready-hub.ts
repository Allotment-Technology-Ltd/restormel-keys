/**
 * M2 "Verify" make-ready hub — pure, DOM-free logic for the three readiness
 * gates, the trust meter, and the honest "mark ready" guard (RES-113 PR-D,
 * gated behind `onboardingJourney`).
 *
 * The make-ready hub reskins the existing verify surfaces (ConnectTrustScorecard +
 * ConnectVerifiedReadiness + ClaimsStampingDesk) as three honest gates — Sources,
 * Embed, Validate — over the SAME signals those surfaces already load. This module
 * owns the decisions so the Svelte shell stays presentational and the rules are
 * unit-testable (the dashboard test env is `node`, no DOM).
 *
 * Two honesty invariants this module enforces (REC-ADR-016 — name the real state,
 * never fake progress):
 *
 *  1. **"Ready" means triaged, not green.** The accept-guard (claims-stamping-desk.ts /
 *     evidence-dossier.ts) lets a claim land as Weak or Unsupported — that is a
 *     completed verdict, not a failure. So `resolveMarkReady` clears the bar when
 *     every claim has a verdict (`awaitingTriage === 0`), NOT when weak/unsupported
 *     hit zero. A production-grade graph can still hold honestly-weak claims.
 *
 *  2. **No live-climbing trust meter.** Trust recompute after triage is DEFERRED
 *     (the desk surfaces `SESSION_TRUST_DELTA_DEFERRED`), so the meter shows a
 *     deferred / verified STATE, never an animated number racing upward. The
 *     `recomputeState` here drives a StateChip, not a tween.
 */

import type { StateChipState } from "$lib/components/brutalist/StateChip.svelte";
import type { ConnectSpine, ConnectSpineStageState } from "$lib/connect/connect-spine";

/** The three make-ready gates (03_SCREENS.md M2 / `M2 Make Ready.html`). */
export type MakeReadyGateId = "sources" | "embed" | "validate";

/**
 * Honest gate state. `done_auto` = the system cleared it with nothing for the
 * user; `needs_you` = a human must act (amber); `needs_review` = flagged claims
 * await a verdict (coral); `running` = still computing / embedding (no fake 100%).
 */
export type MakeReadyGateState = "done_auto" | "needs_you" | "needs_review" | "running";

export type MakeReadyGate = {
  id: MakeReadyGateId;
  /** Hub card title, e.g. "Link to sources". */
  title: string;
  /** One-line plain-English purpose. */
  blurb: string;
  state: MakeReadyGateState;
  /** Maps the gate state onto an existing StateChip variant (zero new tokens). */
  chipState: StateChipState;
  /** Mono chip label, e.g. "Done · auto" / "Needs you" / "Needs review". */
  chipLabel: string;
  /** 0–100 integer progress, or null when there is nothing meaningful to fill. */
  pct: number | null;
  /** Mono receipt line, e.g. "164 need a link" / "1,204 vectors" / "47 flagged". */
  detail: string;
  /** True when a human still has to act (drives the "N of 3 need you" tally). */
  needsYou: boolean;
};

/** Per-EBV-Layer-1 evidence binding (scorecard.evidence) — drives the Sources gate. */
export type MakeReadyEvidence = {
  bound: number;
  unbound: number;
  noEvidence: number;
  /** Integer 0–100. */
  boundPct: number;
};

/** Validation breakdown — the same shape the graph stats + stamping desk consume. */
export type MakeReadyValidation = {
  ok: number;
  weak: number;
  unsupported: number;
  unvalidated: number;
  /** Claims flagged by the validator that still have no operator verdict. */
  awaitingTriage: number;
  /** Subset of awaiting that the validator marked unsupported (the priority queue). */
  unsupportedUntriaged: number;
};

export type MakeReadySignals = {
  /** kg-audit trust score (0–100) quoted from the scorecard service; null when no graph. */
  trustScore: number | null;
  /** Latest EBV judgment time (ISO) or null when never verified. */
  lastVerifiedAt: string | null;
  units: number;
  embedded: number;
  /** Sources-gate signal; null when the scorecard could not be read (gate shows "computing"). */
  evidence: MakeReadyEvidence | null;
  validation: MakeReadyValidation;
};

const GATE_COPY: Record<MakeReadyGateId, { title: string; blurb: string }> = {
  sources: {
    title: "Link to sources",
    blurb: "Every idea traces back to where it came from.",
  },
  embed: {
    title: "Embed for retrieval",
    blurb: "Ideas are findable by your app. Runs itself.",
  },
  validate: {
    title: "Validate ideas",
    blurb: "Claims cross-checked; weak ones flagged for you.",
  },
};

/** Map an honest gate state onto an EXISTING StateChip variant + its mono label. */
const GATE_CHIP: Record<MakeReadyGateState, { chipState: StateChipState; chipLabel: string }> = {
  done_auto: { chipState: "done", chipLabel: "Done · auto" },
  needs_you: { chipState: "weak", chipLabel: "Needs you" },
  needs_review: { chipState: "error", chipLabel: "Needs review" },
  running: { chipState: "running", chipLabel: "Working…" },
};

function pctOf(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((Math.min(part, whole) / whole) * 100);
}

/** Thousands-grouped integer for receipt lines ("1,204 vectors"). */
function num(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString();
}

function gate(id: MakeReadyGateId, state: MakeReadyGateState, pct: number | null, detail: string, needsYou: boolean): MakeReadyGate {
  const chip = GATE_CHIP[state];
  return { id, ...GATE_COPY[id], state, chipState: chip.chipState, chipLabel: chip.chipLabel, pct, detail, needsYou };
}

/**
 * Sources gate — every idea bound to a source (scorecard EBV Layer-1 binding).
 *
 * The `units <= 0` pre-graph branch is RETAINED as defence-in-depth. PR-6a landed
 * the gate: `M2VerifyHub` now mounts only when `resolveM2Surface` reads
 * `triage`/`ready` (both imply `units > 0`), so this branch is unreachable from
 * the shipped shells — but deleting it would flip any future direct render on an
 * empty workspace to a dishonest "all 0 grounded · Done" (0 unbound ⇒ done_auto),
 * i.e. a fabricated-DONE (REC-ADR-016). On `units <= 0` the gate keeps naming the
 * honest pre-graph state ("no ideas yet").
 */
export function buildSourcesGate(s: MakeReadySignals): MakeReadyGate {
  if (s.units <= 0) return gate("sources", "running", null, "no ideas yet", false);
  if (!s.evidence) return gate("sources", "running", null, "reading source links…", false);
  const needLink = s.evidence.unbound + s.evidence.noEvidence;
  if (needLink <= 0) return gate("sources", "done_auto", 100, `all ${num(s.evidence.bound)} grounded`, false);
  return gate("sources", "needs_you", s.evidence.boundPct, `${num(needLink)} need a link`, true);
}

/**
 * Embed gate — vectorised for retrieval. Runs itself; never blocks the user.
 * (`units <= 0` pre-graph branch RETAINED as defence-in-depth now PR-6a gates
 * the hub on `resolveM2Surface` — without it, `0 >= 0` would flip an empty
 * workspace to a dishonest "0 vectors · Done"; see `buildSourcesGate`.)
 */
export function buildEmbedGate(s: MakeReadySignals): MakeReadyGate {
  if (s.units <= 0) return gate("embed", "running", null, "no ideas yet", false);
  const pct = pctOf(s.embedded, s.units);
  if (s.embedded >= s.units) return gate("embed", "done_auto", 100, `${num(s.embedded)} vectors`, false);
  return gate("embed", "running", pct, `${num(s.embedded)} of ${num(s.units)} vectorised`, false);
}

/**
 * Validate gate — the trust gate. DONE means every flagged claim carries a
 * verdict (`awaitingTriage === 0`), NOT that weak/unsupported reached zero
 * (accept-guard: a triaged-weak claim is finished, not a failure).
 * (`units <= 0` pre-graph branch RETAINED as defence-in-depth now PR-6a gates
 * the hub on `resolveM2Surface` — without it, `awaitingTriage === 0` would flip an
 * empty workspace to a dishonest "0 flagged · all triaged · Done"; see `buildSourcesGate`.)
 */
export function buildValidateGate(s: MakeReadySignals): MakeReadyGate {
  const v = s.validation;
  if (s.units <= 0) return gate("validate", "running", null, "no ideas yet", false);
  const triaged = v.ok + v.weak + v.unsupported;
  const considered = triaged + v.awaitingTriage;
  const pct = pctOf(triaged, considered);
  if (v.awaitingTriage <= 0) return gate("validate", "done_auto", 100, "0 flagged · all triaged", false);
  return gate(
    "validate",
    "needs_review",
    pct,
    `${num(v.awaitingTriage)} flagged of ${num(considered)}`,
    true,
  );
}

/** All three gates in hub order (Sources · Embed · Validate). */
export function buildMakeReadyGates(s: MakeReadySignals): MakeReadyGate[] {
  return [buildSourcesGate(s), buildEmbedGate(s), buildValidateGate(s)];
}

export type MakeReadyTrustMeter = {
  /** The quoted score (0–100) or null when there is no graph to score. */
  score: number | null;
  /** Deferred-recompute STATE for the StateChip — never an animated climb. */
  recomputeState: StateChipState;
  /** Mono label, e.g. "Verified" / "Recompute pending" / "No graph yet". */
  recomputeLabel: string;
  lastVerifiedAt: string | null;
};

/**
 * Trust meter view. The score is quoted as-is; the recompute STATE is what moves
 * (deferred while triage is outstanding, verified once the queue is clear) — there
 * is no live-climbing number (REC-ADR-016 / SESSION_TRUST_DELTA_DEFERRED).
 */
export function buildTrustMeter(s: MakeReadySignals): MakeReadyTrustMeter {
  // Honest absent: pre-graph (`units <= 0`) or a null score has nothing to show.
  // The `units <= 0` half is RETAINED as defence-in-depth now PR-6a gates the hub
  // on `resolveM2Surface` — "No graph yet" stays the honest state for any direct
  // pre-graph render (see `buildSourcesGate`).
  if (s.units <= 0 || s.trustScore === null) {
    return { score: s.trustScore, recomputeState: "idle", recomputeLabel: "No graph yet", lastVerifiedAt: s.lastVerifiedAt };
  }
  if (s.validation.awaitingTriage > 0) {
    return {
      score: s.trustScore,
      recomputeState: "running",
      recomputeLabel: "Recompute pending",
      lastVerifiedAt: s.lastVerifiedAt,
    };
  }
  return { score: s.trustScore, recomputeState: "done", recomputeLabel: "Verified", lastVerifiedAt: s.lastVerifiedAt };
}

export type MakeReadyVerdict = {
  /** True when the graph can be marked production-grade. */
  ready: boolean;
  /** Disabled reason when `!ready` — verbatim, never a silent no-op. */
  reason: string | null;
  /** Claims still awaiting a verdict (0 when ready). */
  outstandingTriage: number;
  /** How many of the three gates still need the user (the "N of 3 need you" tally). */
  gatesNeedingYou: number;
};

/**
 * The "Mark ready →" guard. Honours the accept-guard: the bar clears when every
 * flagged claim has a verdict, NOT when the graph is all-green. Weak and
 * unsupported claims are allowed in a production-grade graph as long as a human
 * has triaged them (assigned the verdict deliberately).
 */
export function resolveMarkReady(s: MakeReadySignals): MakeReadyVerdict {
  const gatesNeedingYou = buildMakeReadyGates(s).filter((g) => g.needsYou).length;
  // The `units <= 0` "No graph yet" branch is RETAINED as defence-in-depth now
  // PR-6a gates the hub on `resolveM2Surface` (the pre-graph case is owned
  // upstream). Without this guard a direct call on an empty workspace (units 0,
  // awaitingTriage 0) would report `ready: true`, a fabricated DONE that
  // REC-ADR-016 forbids.
  if (s.units <= 0) {
    return {
      ready: false,
      reason: "No graph yet — run an ingest first.",
      outstandingTriage: 0,
      gatesNeedingYou,
    };
  }
  const outstanding = s.validation.awaitingTriage;
  if (outstanding > 0) {
    return {
      ready: false,
      reason:
        outstanding === 1
          ? "1 claim still needs a verdict — triage it (Accept, Weaken, or Unsupported)."
          : `${num(outstanding)} claims still need a verdict — triage them (Accept, Weaken, or Unsupported).`,
      outstandingTriage: outstanding,
      gatesNeedingYou,
    };
  }
  return { ready: true, reason: null, outstandingTriage: 0, gatesNeedingYou };
}

/** Hub headline state — drives the "2 of 3 need you" sub-line + the page chip. */
export function makeReadySummary(s: MakeReadySignals): { gatesNeedingYou: number; total: number; line: string } {
  const gates = buildMakeReadyGates(s);
  const need = gates.filter((g) => g.needsYou).length;
  const line = need === 0 ? "all gates clear" : need === 1 ? "1 of 3 needs you" : `${need} of 3 need you`;
  return { gatesNeedingYou: need, total: gates.length, line };
}

// ─────────────────────────────────────────────────────────────────────────────
// M2 surface resolution (RES-113 PR-2 / plan §3.3)
//
// ONE pure predicate for "does the Verify (M2) surface show, and in what mode".
// Both `deriveOnboardingMilestone` (connect-journey.ts) and the Home/`/verify`
// shells consume this so the make-ready gates and the milestone position can never
// disagree about whether M2 is outstanding.
//
// The "outstanding verify work" signal is DERIVED FROM THE SPINE stage states
// (make_ready / review) — exactly the logic previously private inside
// `deriveOnboardingMilestone` as `verifyOutstanding`, promoted here so it has one
// home. connect-journey.ts calls `isVerifyOutstanding` with the spine's own stage
// states; there is no parallel recomputation.
// ─────────────────────────────────────────────────────────────────────────────

/** The M2 surface mode (plan §3.3). */
export type M2Surface =
  /** No built graph — the Verify surface renders zero pixels on Home (the nav tab is the only wayfinding). */
  | "hidden"
  /** Built graph with outstanding verify work — the triage-led hub. */
  | "triage"
  /** Built graph, verify work cleared — the confirmation / "mark ready" surface. */
  | "ready";

/**
 * The spine-derived signals `resolveM2Surface` needs. `graphBuilt` gates the whole
 * surface (`!graphBuilt` ⇒ hidden). The two spine stage states are passed verbatim
 * from `buildConnectSpine(...).stages` so this is the SAME truth the milestone uses
 * — no re-derivation. A stage is "outstanding" exactly when it is `current` (the
 * spine's own definition of "act on this now").
 */
export type M2SurfaceSignals = {
  graphBuilt: boolean;
  /** The spine `make_ready` stage state (embed/link/validate work). */
  makeReadyState: ConnectSpineStageState;
  /** The spine `review` stage state (flagged-claim triage work). */
  reviewState: ConnectSpineStageState;
};

/**
 * True when the graph is built AND the spine still has make-ready or review work
 * outstanding (either stage is `current`). This is the single definition of
 * "verify work remains" — promoted out of `deriveOnboardingMilestone`'s private
 * scope so `connect-journey.ts` and the M2 surface can never drift apart.
 */
export function isVerifyOutstanding(signals: M2SurfaceSignals): boolean {
  return (
    signals.graphBuilt &&
    (signals.makeReadyState === "current" || signals.reviewState === "current")
  );
}

/**
 * Resolve the M2 Verify surface mode (plan §3.3):
 *   • `hidden` when there is no built graph — the spine's nav tab is the only
 *     wayfinding; Home mounts zero M2 pixels (REC-ADR-020: never forced/default).
 *   • `triage` when the graph is built and verify work is outstanding.
 *   • `ready`  when the graph is built and verify work is cleared.
 */
export function resolveM2Surface(signals: M2SurfaceSignals): M2Surface {
  if (!signals.graphBuilt) return "hidden";
  return isVerifyOutstanding(signals) ? "triage" : "ready";
}

// ─────────────────────────────────────────────────────────────────────────────
// PR-6 view-model additions (plan §3.3 / copy pack §3). Pure + DOM-free like
// everything above; the derivation (`resolveM2Surface` / gate builders) is
// unchanged — these only reshape it for the Home tiles and the `/verify` shell.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the M2 surface from a loaded hub spine — the shape Home and `/verify`
 * actually hold. Honesty guards (REC-ADR-016):
 *
 *   • when the spine is missing or a stage state is `unknown` (a partial read
 *     failure), we CANNOT know whether verify work is outstanding → `null` —
 *     the caller renders an honest absence (Home: no tile) or its load-failure
 *     state (`/verify`), never a fabricated "ready";
 *   • `ready` asserts "all facts are MATCHED TO SOURCES" (copy pack §3.3), a
 *     claim the spine's make_ready/review stages never check (they cover
 *     embed + validation only — connect-spine.ts). So the Sources signal is a
 *     hard input here: `evidence` unreadable on a built graph → `null` (the
 *     scorecard read failed — name the failure, never dress it as progress or
 *     completion); units still needing a link → `triage` (the Sources gate
 *     leads), never a "matched to sources" headline the disclosure's own
 *     scorecard would contradict (5-lens review, lens 2 fix).
 *
 * `hidden` needs neither spine nor evidence: it derives from `graphBuilt`
 * alone (REC-ADR-020 — zero M2 pixels pre-graph; a pre-graph scorecard is
 * legitimately null, not a failure).
 */
export function resolveM2SurfaceFromSpine(
  spine: ConnectSpine | null,
  graphBuilt: boolean,
  evidence: Pick<MakeReadyEvidence, "unbound" | "noEvidence"> | null,
): M2Surface | null {
  if (!graphBuilt) return "hidden";
  if (!spine) return null;
  const makeReadyState = spine.stages.find((s) => s.id === "make_ready")?.state ?? "unknown";
  const reviewState = spine.stages.find((s) => s.id === "review")?.state ?? "unknown";
  if (makeReadyState === "unknown" || reviewState === "unknown") return null;
  // A built graph whose scorecard could not be read is a partial read failure:
  // without the evidence signal, neither "matched to sources" (ready) nor the
  // Sources gate's honest count (triage) can be stated.
  if (!evidence) return null;
  const surface = resolveM2Surface({ graphBuilt, makeReadyState, reviewState });
  if (surface === "ready" && Math.max(0, evidence.unbound) + Math.max(0, evidence.noEvidence) > 0) {
    return "triage";
  }
  return surface;
}

/**
 * The triage-screen decisions (copy pack §3.2). The shell owns the literal
 * strings; this model owns WHICH gate leads, what collapses, and the honest
 * headline count, so the priority rule ("earliest gate in pipeline order,
 * expanded alone") lives in one testable place.
 */
export type VerifyTriageModel = {
  /**
   * Honest headline `n` for "{n} facts need your review" (copy pack §3.2).
   * Exact when EXACTLY ONE gate needs the user — that gate's own counted
   * population. `null` when 2+ gates need the user: the Sources population
   * (units needing a link — `evidence_status`) and the Review population
   * (claims awaiting a verdict — `validation_status` + note) are independent
   * per-unit fields that can OVERLAP, so no single honest total exists without
   * a per-unit join (a new query the Stage 1.8 no-new-queries invariant
   * forbids). Summing them would fabricate an inflated count (REC-ADR-016 —
   * 5-lens review, lens 2 fix); the shell renders the countless headline
   * variant instead and the per-gate receipts carry the real numbers.
   * `0` only when no gate needs the user — the shell renders the quiet
   * "still working" state (never a fabricated "0 facts need your review").
   */
  headlineCount: number | null;
  /** The earliest gate in pipeline order (Sources → Searchable → Review) needing the user; null when none does. */
  leadGateId: MakeReadyGateId | null;
  /** The lead gate's honest counted receipt (e.g. "164 need a link"), null when no lead. */
  leadDetail: string | null;
  /** True when 2+ gates need the user → the copy-pack priority lead-in renders. */
  multipleNeedYou: boolean;
  /** Gates the system cleared with nothing for the user → ONE combined receipt line (copy pack A-3). */
  clearedGateIds: MakeReadyGateId[];
  /** Non-lead gates still running (never needing the user) → one honest stage line each. */
  workingGateIds: MakeReadyGateId[];
  /** Non-lead gates that ALSO need the user (come after the lead per the priority rule) — honest receipt each. */
  queuedGates: { id: MakeReadyGateId; detail: string }[];
};

/**
 * Build the triage view for a built graph (`resolveM2Surface === "triage"`).
 * Gate order is the pipeline order (`buildMakeReadyGates`), which IS the
 * priority order the copy pack states: each later check depends on the one
 * before it.
 */
export function buildVerifyTriageModel(s: MakeReadySignals): VerifyTriageModel {
  const gates = buildMakeReadyGates(s);
  const needing = gates.filter((g) => g.needsYou);
  const lead = needing[0] ?? null;
  // Per-gate honest populations (each a real counted number; see `headlineCount`
  // for why they are never summed).
  const needLink =
    s.units > 0 && s.evidence ? Math.max(0, s.evidence.unbound + s.evidence.noEvidence) : 0;
  const gateCount: Record<MakeReadyGateId, number> = {
    sources: needLink,
    embed: 0, // Searchable runs itself — never a user population.
    validate: Math.max(0, s.validation.awaitingTriage),
  };
  const headlineCount =
    needing.length === 0 ? 0 : needing.length === 1 ? gateCount[needing[0].id] : null;
  return {
    headlineCount,
    leadGateId: lead?.id ?? null,
    leadDetail: lead?.detail ?? null,
    multipleNeedYou: needing.length >= 2,
    clearedGateIds: gates.filter((g) => g.state === "done_auto").map((g) => g.id),
    workingGateIds: gates
      .filter((g) => g.state === "running" && g.id !== lead?.id)
      .map((g) => g.id),
    queuedGates: needing.slice(1).map((g) => ({ id: g.id, detail: g.detail })),
  };
}
