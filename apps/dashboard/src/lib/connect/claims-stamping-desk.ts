/**
 * The Stamping Desk (W4.2) — pure logic for the keyboard-first claim triage loop.
 *
 * The Svelte component (`ClaimsStampingDesk.svelte`) is a thin shell over this
 * module: it owns the DOM and the focus management, this module owns the
 * decisions. Everything here is deterministic and DOM-free so it can be unit
 * tested directly (the dashboard test environment is `node`, no jsdom).
 *
 * Truth sources this module quotes (never forks):
 *   - the verdict vocabulary (`KnownValidationStatus` = ok | weak | unsupported)
 *     and the existing explorer mutation path (`performReview` → PATCH
 *     /graph/units/{id}/validation). S maps to `ok`, X maps to `unsupported`.
 *   - the accept-guard (`canAcceptAsSupported`, evidence-dossier.ts, claims
 *     ledger row 2): an unbound claim can NEVER be stamped supported. The desk
 *     surfaces that as a disabled S stamp with the verbatim reason — never a
 *     silent no-op.
 *
 * Undo semantics (honest): the server validation endpoint accepts only
 * { ok | weak | unsupported } — there is NO "un-stamp" / clear-to-unchecked.
 * So a true server-side undo of a *first* verdict (prior status was unchecked /
 * null) does not exist. The desk implements single-level undo as a RE-STAMP to
 * the previous verdict, and is honestly disabled when the previous status was
 * unchecked (`describeUndo` returns canUndo:false with the reason). See
 * `DeskStampRecord.fromStatus`.
 */

import type { KnownValidationStatus } from "$lib/connect/validation-status";
import {
  canAcceptAsSupported,
  type UnitEvidenceSummary,
} from "$lib/connect/evidence-dossier";

/** The keys the desk listens for. `?` is the legend toggle; Escape exits. */
export type DeskCommand =
  | { kind: "advance" } //   j / n / ArrowDown / ArrowRight
  | { kind: "retreat" } //   k / p / ArrowUp / ArrowLeft
  | { kind: "stamp"; status: KnownValidationStatus } // s → ok, x → unsupported
  | { kind: "evidence" } //  e — open / focus the evidence excerpt
  | { kind: "note" } //      n — focus the note field (does NOT advance)
  | { kind: "undo" } //      z — re-stamp the last claim to its prior verdict
  | { kind: "legend" } //    ? — toggle the shortcut legend overlay
  | { kind: "blur" } //      Escape while in the note field — leave the field only
  | { kind: "exit" }; //     Escape (outside the note) — leave the desk entirely

/** Context the dispatcher needs to decide whether a key does anything. */
export type DeskKeyContext = {
  /** True when the keydown originated in an input/textarea/select/contenteditable. */
  fromTextEntry: boolean;
  /**
   * True when the desk surface is read-only (mobile read-only tier OR as-of
   * history). In read-only mode navigation + legend + exit still work, but no
   * stamp / note / undo command is ever produced.
   */
  readonly: boolean;
};

/**
 * Map a raw keydown to a desk command, or null for "not a desk key / suppressed".
 *
 * Suppression rules (rubric X10, ACCEPTANCE: "shortcuts never hijack typing"):
 *   - When the event came from a text-entry target, ONLY Escape is honoured —
 *     and it is a TWO-STEP escape: the first Escape blurs the note field
 *     (`{kind:"blur"}`), it does NOT tear down the whole desk. Every letter key
 *     types. Once focus has left the field, a subsequent Escape exits.
 *   - When read-only, mutating commands (stamp / note / undo) are dropped;
 *     read-only navigation, legend and exit remain.
 */
export function dispatchDeskKey(key: string, ctx: DeskKeyContext): DeskCommand | null {
  const isEscape = key === "Escape" || key === "Esc";

  // Two-step escape: while typing in the note field, Escape only leaves the
  // field — it must not also exit the desk (that loses the operator's place and
  // surprises anyone who pressed Escape just to stop editing).
  if (ctx.fromTextEntry) {
    if (isEscape) return { kind: "blur" };
    // Inside a text field, no other shortcut fires — the operator is typing.
    return null;
  }

  // Outside the note field, Escape leaves the desk entirely.
  if (isEscape) return { kind: "exit" };

  switch (key) {
    // J/K are canonical (and arrows mirror them). `n`/`p` are intentionally NOT
    // navigation in the desk: the spec maps N to the note field, so binding both
    // would be ambiguous. The legend documents J/K + arrows as the queue keys.
    case "j":
    case "J":
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "advance" };
    case "k":
    case "K":
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "retreat" };
    case "s":
    case "S":
      return ctx.readonly ? null : { kind: "stamp", status: "ok" };
    case "x":
    case "X":
      return ctx.readonly ? null : { kind: "stamp", status: "unsupported" };
    case "w":
    case "W":
      // Parity with the explorer's existing `w` = weak verdict.
      return ctx.readonly ? null : { kind: "stamp", status: "weak" };
    case "e":
    case "E":
      return { kind: "evidence" };
    case "n":
    case "N":
      return ctx.readonly ? null : { kind: "note" };
    case "z":
    case "Z":
      return ctx.readonly ? null : { kind: "undo" };
    case "?":
      return { kind: "legend" };
    default:
      return null;
  }
}

// ── Session tally ───────────────────────────────────────────────────────────

/**
 * Per-visit tally. `reviewed` counts every stamp the operator lands this
 * session (re-stamps via undo decrement, so the rail never lies about how many
 * claims are *currently* stamped by this session). The score delta is NOT
 * tracked here — see `SESSION_TRUST_DELTA_DEFERRED`.
 */
export type DeskTally = {
  reviewed: number;
  supported: number; // status === "ok"
  weak: number;
  rejected: number; // status === "unsupported"
};

export function emptyDeskTally(): DeskTally {
  return { reviewed: 0, supported: 0, weak: 0, rejected: 0 };
}

function bucket(status: KnownValidationStatus): keyof Omit<DeskTally, "reviewed"> {
  if (status === "ok") return "supported";
  if (status === "unsupported") return "rejected";
  return "weak";
}

/** Add a landed stamp to the tally (immutable). */
export function tallyStamp(tally: DeskTally, status: KnownValidationStatus): DeskTally {
  return {
    ...tally,
    reviewed: tally.reviewed + 1,
    [bucket(status)]: tally[bucket(status)] + 1,
  };
}

/**
 * Remove the most recent stamp from the tally (used when undo re-stamps to the
 * prior verdict — the undone stamp no longer counts toward this session). Never
 * goes below zero.
 */
export function tallyUndo(tally: DeskTally, undoneStatus: KnownValidationStatus): DeskTally {
  const key = bucket(undoneStatus);
  return {
    ...tally,
    reviewed: Math.max(0, tally.reviewed - 1),
    [key]: Math.max(0, tally[key] - 1),
  };
}

/**
 * The ledger line shown in the session rail, e.g.
 * "REVIEWED 14 · SUPPORTED 11 · WEAK 0 · REJECTED 3". Mono uppercase, factual.
 */
export function formatTallyLine(tally: DeskTally): string {
  return (
    `REVIEWED ${tally.reviewed}` +
    ` · SUPPORTED ${tally.supported}` +
    ` · WEAK ${tally.weak}` +
    ` · REJECTED ${tally.rejected}`
  );
}

/** A spoken announcement after a stamp, e.g. "Supported. 11 remaining." */
export function announceStamp(status: KnownValidationStatus, remaining: number): string {
  const verb =
    status === "ok" ? "Supported" : status === "unsupported" ? "Rejected" : "Marked weak";
  const tail =
    remaining <= 0
      ? "Queue clear."
      : `${remaining} remaining.`;
  return `${verb}. ${tail}`;
}

// ── Accept-guard surfaced state (claims ledger row 2) ─────────────────────────

export type DeskStampOption = {
  status: KnownValidationStatus;
  /** S / X / W — the legend key. */
  key: string;
  label: string;
  /** False when the stamp must be shown disabled (only ever for Supported). */
  enabled: boolean;
  /** Verbatim refusal reason when disabled; null when enabled. */
  reason: string | null;
};

/**
 * The desk's three stamps with the accept-guard applied. Only the Supported (S)
 * stamp can be guarded off: an unbound / pre-binding / no-evidence claim can
 * never be marked supported (canAcceptAsSupported), so S is disabled with the
 * guard's verbatim reason. Weak and Rejected are always available — flagging a
 * claim down never needs a bound span.
 */
export function deskStampOptions(
  evidence: Pick<UnitEvidenceSummary, "verificationState" | "evidenceStatus"> | null | undefined,
): DeskStampOption[] {
  const guard = canAcceptAsSupported(evidence ?? null);
  return [
    {
      status: "ok",
      key: "S",
      label: "Supported",
      enabled: guard.ok,
      reason: guard.ok ? null : guard.reason,
    },
    { status: "weak", key: "W", label: "Weak", enabled: true, reason: null },
    { status: "unsupported", key: "X", label: "Rejected", enabled: true, reason: null },
  ];
}

/** True when the S stamp is currently allowed for this claim's evidence. */
export function canStampSupported(
  evidence: Pick<UnitEvidenceSummary, "verificationState" | "evidenceStatus"> | null | undefined,
): boolean {
  return canAcceptAsSupported(evidence ?? null).ok;
}

// ── Undo (single-level, honest) ───────────────────────────────────────────────

/** Recorded for the last landed stamp so undo can re-stamp to the prior value. */
export type DeskStampRecord = {
  unitId: string;
  /** The verdict applied. */
  toStatus: KnownValidationStatus;
  /**
   * The unit's validation status BEFORE this stamp. A known verdict means undo
   * can re-stamp to it; null means the claim was unchecked and there is no
   * server status to restore (undo of a first stamp has nothing to revert to).
   */
  fromStatus: KnownValidationStatus | null;
};

export type UndoState =
  | { canUndo: true; toStatus: KnownValidationStatus; unitId: string }
  | { canUndo: false; reason: string };

/**
 * Decide whether the last stamp can be undone, and to what.
 *
 * Honest contract: undo is a RE-STAMP to `fromStatus` using the same validation
 * mutation. When `fromStatus` is null the claim had no prior verdict and the
 * server has no "unchecked" status to write back to — so undo is disabled with a
 * reason rather than pretending to clear the verdict.
 */
export function describeUndo(last: DeskStampRecord | null): UndoState {
  if (!last) {
    return { canUndo: false, reason: "Nothing stamped yet this session." };
  }
  if (last.fromStatus == null) {
    return {
      canUndo: false,
      reason:
        "This idea had no prior verdict — there is no earlier state to restore. " +
        "Stamp a different verdict to change it.",
    };
  }
  return { canUndo: true, toStatus: last.fromStatus, unitId: last.unitId };
}

// ── Deferred: per-session trust-score delta ───────────────────────────────────

/**
 * STOP decision (W4.2): the UX target line includes a "trust +2.1 this session"
 * figure. The trust score (TRUST_SCORE_FORMULA, computeTrustScoreBreakdown) is
 * computed from EBV inputs — accepted_claims, accepted_unverified, missing
 * embeddings, orphan claims, vector-index health, relation balance — NONE of
 * which the explorer holds client-side (it carries the validation breakdown and
 * verification-state counts only). A faithful per-session delta would require
 * either shipping the full EBV input vector to the client or a cheap recompute
 * endpoint. Per the stage prompt ("if per-session delta needs a cheap recompute
 * endpoint, STOP and propose it") we DEFER the numeric trust delta rather than
 * fork or fabricate the formula. The session rail shows the truthful tally
 * (reviewed / supported / weak / rejected) and an honest note that the trust
 * figure recomputes on the Home scorecard, which is the single source.
 */
export const SESSION_TRUST_DELTA_DEFERRED =
  "Trust score recomputes on the Home scorecard from evidence states — view it there.";
