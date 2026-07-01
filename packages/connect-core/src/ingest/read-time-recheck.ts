/**
 * EBV read-time freshness enforcement — "verified is TRUE at query time".
 * (docs/decisions/evidence-bound-verification.md §2, approved 2026-06-09)
 *
 * Layer-1 binding is deterministic over hashed source content, so it is re-runnable at
 * READ time — and the ADR is explicit that strict retrieval MUST require a fresh Layer-1
 * pass before serving a claim, "so verification cannot silently rot":
 *
 *   > Because it is deterministic over hashed content, it is re-runnable at read time:
 *   > strict retrieval can require a fresh Layer-1 pass (or unchanged source hash) before
 *   > serving a claim ... a hash mismatch or moved quote means verification has rotted,
 *   > and the claim can no longer be served as supported.
 *
 * Ingest persists `verification_state` once; this module is the SERVE-time guard that
 * re-derives the EFFECTIVE state from a fresh deterministic recheck of the claim's bound
 * span against the CURRENT source version. It never invents a verdict and never calls a
 * model — it consumes the outcome of a Layer-1 recheck (the same deterministic check as
 * `verifyEvidenceSpan`, run against live source text by the caller) and decides whether
 * the stored `supported`/`inferred` state may still be served.
 *
 * Direction of force (fail-closed, never fabricate — abstention ADR rule preserved):
 *   - a recheck pass keeps the stored state;
 *   - a recheck failure (stale source / moved quote / out-of-range offsets) DEMOTES a
 *     `supported` claim to `unverified` (→ review), so a rotted claim is never served as
 *     verified;
 *   - an unrunnable recheck (source text unavailable) ALSO demotes a `supported` claim —
 *     strict retrieval requires a fresh pass; if we cannot run it, we cannot assert
 *     "verified" (the same fail-closed posture as `recheckResultCopy`);
 *   - a state is NEVER promoted by a recheck (a passing recheck cannot turn `unverified`
 *     into `supported` — that needs Layer 2);
 *   - non-support states (`unverified` / `contradicted` / `excluded`) pass through.
 *
 * Pure and store-agnostic: the caller supplies the recheck outcome (resolved from
 * whatever store holds the source text); this module owns only the decision, the served
 * summary recompute, and the audit-row projection. Fully unit-testable with fixtures.
 */
import type { ClaimVerificationState } from "./verification-state.js";
import type { EvidenceMatchKind } from "./evidence-binding.js";

/**
 * Why a read-time recheck did not pass. Mirrors the deterministic Layer-1 failure modes
 * (`SpanVerification`) plus the two read-time-only cases (source text could not be
 * resolved; the claim carries no bound span to recheck).
 */
export type ReadTimeRecheckReason =
  | "stale_source" // source content hash changed since binding (Layer-1 hash_mismatch)
  | "span_lost" // the quote no longer sits at its recorded offsets (Layer-1 text_changed)
  | "offsets_out_of_range" // recorded offsets fall outside the current source text
  | "source_unavailable" // current source text could not be resolved → cannot prove freshness
  | "no_bound_span"; // claim has no bound evidence span to recheck

/**
 * The canonical read-time recheck outcome the decision consumes. `ok: true` means a
 * fresh deterministic Layer-1 pass succeeded against the CURRENT source version.
 */
export type ReadTimeRecheckOutcome =
  | { ok: true; match: EvidenceMatchKind }
  | { ok: false; reason: ReadTimeRecheckReason };

/** A served claim as presented to the read-time guard. */
export type ServedClaimRecheck = {
  /** Graph record id of the claim/unit (matches the verified-claim envelope `claim.id`). */
  id: string;
  /** The verification state persisted at ingest (the stored truth). */
  storedState: ClaimVerificationState;
  /** The fresh Layer-1 recheck outcome against the current source version. */
  outcome: ReadTimeRecheckOutcome;
};

export type ReadTimeRecheckResult = {
  id: string;
  storedState: ClaimVerificationState;
  /** The state the claim may actually be served as, after the fresh recheck. */
  effectiveState: ClaimVerificationState;
  /** True when the fresh recheck lowered the served state below its stored value. */
  demoted: boolean;
  /**
   * null  → the state was not subject to read-time Layer-1 freshness (non-support state,
   *         or an `inferred` claim that legitimately carries no bound span);
   * true  → a fresh Layer-1 pass succeeded;
   * false → a fresh Layer-1 pass failed or could not be run (see `reason`).
   */
  fresh: boolean | null;
  reason: ReadTimeRecheckReason | null;
  match: EvidenceMatchKind | null;
};

/**
 * Only states that ASSERT a live Layer-1 binding are gated at read time. `supported`
 * (Layer 1 ∧ Layer 2) and `inferred` (entailed; Layer-1 partial) are the two states whose
 * served truth can rot when a source changes. Everything else is review/exclusion state
 * already and is passed through untouched (and never promoted).
 */
function isFreshnessGated(state: ClaimVerificationState): state is "supported" | "inferred" {
  return state === "supported" || state === "inferred";
}

/**
 * Decide the effective served state for one claim from its fresh recheck outcome.
 *
 * Demotion always lands in `unverified` (the ADR's review state) — never silently kept as
 * supported, never hard-failed/deleted. A demoted claim keeps its recorded history; it
 * just stops being served as verified until re-bound (re-ingest) or re-judged.
 */
export function decideServedState(claim: ServedClaimRecheck): ReadTimeRecheckResult {
  const base = { id: claim.id, storedState: claim.storedState };

  if (!isFreshnessGated(claim.storedState)) {
    // Non-support states are not freshness-gated and are never promoted by a recheck.
    return { ...base, effectiveState: claim.storedState, demoted: false, fresh: null, reason: null, match: null };
  }

  if (claim.outcome.ok) {
    return {
      ...base,
      effectiveState: claim.storedState,
      demoted: false,
      fresh: true,
      reason: null,
      match: claim.outcome.match,
    };
  }

  // An `inferred` claim that legitimately has no bound span is not falsified by source
  // change — its label was never a Layer-1 binding claim. `supported` with no bound span
  // is an inconsistency and fails closed (a supported claim MUST carry a bound span).
  if (claim.outcome.reason === "no_bound_span" && claim.storedState === "inferred") {
    return { ...base, effectiveState: "inferred", demoted: false, fresh: null, reason: null, match: null };
  }

  return {
    ...base,
    effectiveState: "unverified",
    demoted: true,
    fresh: false,
    reason: claim.outcome.reason,
    match: null,
  };
}

/** Decide the effective served state for a batch of claims. */
export function decideServedStates(claims: ServedClaimRecheck[]): ReadTimeRecheckResult[] {
  return claims.map(decideServedState);
}

export type ReadTimeRecheckSummary = {
  /** True when at least one claim actually had a fresh Layer-1 pass attempted. */
  applied: boolean;
  /** Claims a fresh Layer-1 pass was attempted for (gated states with a runnable recheck). */
  rechecked: number;
  /** Rechecked claims that passed and kept their stored state. */
  fresh: number;
  /** Claims demoted from a stored support state because verification had rotted. */
  demoted: number;
  /** Demotion reason → count (only present reasons appear). */
  demoted_by_reason: Partial<Record<ReadTimeRecheckReason, number>>;
};

/**
 * The REAL served-truth recompute: the freshness summary is computed from the fresh
 * rechecks just run, not from a stored snapshot or an animated meter. This is the number
 * a surface may honestly call "verified right now".
 */
export function summarizeReadTimeRecheck(results: ReadTimeRecheckResult[]): ReadTimeRecheckSummary {
  let rechecked = 0;
  let fresh = 0;
  let demoted = 0;
  const demoted_by_reason: Partial<Record<ReadTimeRecheckReason, number>> = {};
  for (const r of results) {
    if (r.fresh === true) {
      rechecked += 1;
      fresh += 1;
    } else if (r.fresh === false) {
      rechecked += 1;
    }
    if (r.demoted && r.reason) {
      demoted += 1;
      demoted_by_reason[r.reason] = (demoted_by_reason[r.reason] ?? 0) + 1;
    }
  }
  return { applied: rechecked > 0, rechecked, fresh, demoted, demoted_by_reason };
}

/**
 * Recompute a served per-state count map by moving every demoted claim out of its stored
 * state and into `unverified`. The input map is the stored verification summary; the
 * output is the served-truth summary AFTER read-time freshness enforcement.
 *
 * Counts never go negative (a claim is only ever moved once, and only out of a state it
 * was counted under); a demotion that would underflow its stored bucket is clamped, which
 * can only happen if the caller passes an inconsistent map.
 */
export function applyDemotionsToSummary(
  storedSummary: Partial<Record<ClaimVerificationState, number>>,
  results: ReadTimeRecheckResult[],
): Partial<Record<ClaimVerificationState, number>> {
  const out: Partial<Record<ClaimVerificationState, number>> = { ...storedSummary };
  for (const r of results) {
    if (!r.demoted) continue;
    const from = r.storedState;
    const current = out[from] ?? 0;
    if (current > 0) out[from] = current - 1;
    out.unverified = (out.unverified ?? 0) + 1;
  }
  // Drop emptied buckets so the served summary doesn't carry zero-count noise.
  for (const key of Object.keys(out) as ClaimVerificationState[]) {
    if ((out[key] ?? 0) <= 0 && key !== "unverified") delete out[key];
  }
  return out;
}

/**
 * Audit-row projection (one per claim a fresh recheck was attempted for) for persistence
 * to `connect_claim_versions` (migration 074): `recheck_result` is 'fresh' or the failure
 * reason, with the time it was checked. Lets the trust scorecard report a "freshly
 * verified" share without re-resolving every source on each read (ADR §2: Layer-1 results
 * are recorded in the provenance trace as `{ ..., checked_at, result }`).
 *
 * `checkedAt` is supplied by the caller (the time the live recheck ran) so the projection
 * stays pure/deterministic.
 */
export function buildRecheckAuditRows(
  results: ReadTimeRecheckResult[],
  checkedAt: string,
): { unitId: string; result: "fresh" | ReadTimeRecheckReason; checkedAt: string }[] {
  const rows: { unitId: string; result: "fresh" | ReadTimeRecheckReason; checkedAt: string }[] = [];
  for (const r of results) {
    if (r.fresh === true) {
      rows.push({ unitId: r.id, result: "fresh", checkedAt });
    } else if (r.fresh === false && r.reason) {
      rows.push({ unitId: r.id, result: r.reason, checkedAt });
    }
  }
  return rows;
}
