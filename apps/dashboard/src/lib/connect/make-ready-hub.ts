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
 * The `units <= 0` "no ideas yet" fabricated branch is DELETED (REC-ADR-016): the
 * gates never render on an empty workspace (Home mounts M2 content only for the
 * `triage`/`ready` surface — see `resolveM2Surface`), so a fake "running" state for
 * `units === 0` was unreachable-in-truth and dishonest. The genuine "signal
 * unavailable" case (`evidence === null` — the scorecard could not be read) stays:
 * that is an honest "computing", not a fabricated empty state.
 */
export function buildSourcesGate(s: MakeReadySignals): MakeReadyGate {
  if (!s.evidence) return gate("sources", "running", null, "reading source links…", false);
  const needLink = s.evidence.unbound + s.evidence.noEvidence;
  if (needLink <= 0) return gate("sources", "done_auto", 100, `all ${num(s.evidence.bound)} grounded`, false);
  return gate("sources", "needs_you", s.evidence.boundPct, `${num(needLink)} need a link`, true);
}

/**
 * Embed gate — vectorised for retrieval. Runs itself; never blocks the user.
 * (`units <= 0` fabricated branch deleted — REC-ADR-016; the gate never renders
 * pre-graph.)
 */
export function buildEmbedGate(s: MakeReadySignals): MakeReadyGate {
  const pct = pctOf(s.embedded, s.units);
  if (s.embedded >= s.units) return gate("embed", "done_auto", 100, `${num(s.embedded)} vectors`, false);
  return gate("embed", "running", pct, `${num(s.embedded)} of ${num(s.units)} vectorised`, false);
}

/**
 * Validate gate — the trust gate. DONE means every flagged claim carries a
 * verdict (`awaitingTriage === 0`), NOT that weak/unsupported reached zero
 * (accept-guard: a triaged-weak claim is finished, not a failure).
 * (`units <= 0` fabricated branch deleted — REC-ADR-016.)
 */
export function buildValidateGate(s: MakeReadySignals): MakeReadyGate {
  const v = s.validation;
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
  // Honest absent: a null score has nothing to show. The `units <= 0` half of this
  // guard is DELETED (REC-ADR-016) — the meter never renders pre-graph (Home gates
  // M2 on `resolveM2Surface`), and a graph with units but a genuinely-null score is
  // still "no score yet", driven by the score itself, not a fabricated unit check.
  if (s.trustScore === null) {
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
  // The `units <= 0` "No graph yet" branch is DELETED (REC-ADR-016): the mark-ready
  // guard only ever runs inside the `ready`/`triage` M2 surface (a built graph), so
  // the pre-graph case is handled upstream by `resolveM2Surface` returning "hidden"
  // — this function no longer fabricates a no-graph verdict of its own.
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
  makeReadyState: string;
  /** The spine `review` stage state (flagged-claim triage work). */
  reviewState: string;
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
