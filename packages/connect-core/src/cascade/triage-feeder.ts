/**
 * Cascade → triage feeder (RES-113 verification-UI PR-0; placement spec §3.2, §5 item 1).
 *
 * Server-only, DOM-free, zero UI. This is the seam that lets the verifier cascade
 * (cascade.ts, speaking the four-value `Verdict` union) feed the two shipped consumer
 * vocabularies WITHOUT either side importing the other's reasoning:
 *
 *   1. **EBV verification state** (`ClaimVerificationState`, ingest/verification-state.ts) —
 *      the product-facing per-claim truth the graph store persists. `abstained` lands in
 *      `unverified` (the shipped `abstained` URL alias, explorer-url-state.ts §"abstained is
 *      an inbound alias", already maps abstentions to the `unverified` review state — this
 *      feeder is the write-side counterpart of that read-side alias).
 *
 *   2. **Triage counts** (`MakeReadyValidation.awaitingTriage`, apps/dashboard
 *      lib/connect/make-ready-hub.ts) — the "flagged, no operator verdict yet" queue that
 *      drives the Validate gate ("{n} flagged of {m}") and the "Mark ready" guard. A claim
 *      awaits triage exactly when the cascade did NOT decisively resolve it (skill §4:
 *      abstention is a real, reportable outcome routed to a human — never swallowed, never
 *      laundered into a pass).
 *
 * This module speaks ONLY `Verdict` inward (skill §4: no vocabulary mixing inside a
 * reasoning module). It imports `ClaimVerificationState` / `EvidenceBinding` as OUTPUT
 * TYPES only — it never reads or produces the `EntailmentVerdict` union. The mapping is the
 * write-side mirror of the read-side alias and of `deriveLayer2State`'s abstain/not-entailed
 * → `unverified` rule, applied to the cascade vocabulary:
 *
 *   supported     + bound span  -> "supported"   (Layer 1 ∧ Layer 2: the full EBV bar)
 *   supported     + no binding   -> "inferred"    (entailed but no bound span — never laundered)
 *   contradicted                 -> "contradicted"
 *   unverifiable                 -> "unverified"  (span silent — routed to review)
 *   abstained                    -> "unverified"  (cascade exhausted — routed to human review)
 *
 * Honesty (skill §4, REC-ADR-016): no cascade verdict maps to "supported" without a bound
 * span; abstention and unverifiable both surface as the reviewable `unverified` state and
 * both count toward `awaitingTriage` — never as silent progress, never as a fabricated pass.
 *
 * No node:crypto, no DB/Surreal deps — connect-core stays MIT (skill §Workflow step 3).
 */

import type { EvidenceBinding } from "../ingest/evidence-binding.js";
import type { ClaimVerificationState } from "../ingest/verification-state.js";
import type { Verdict } from "./verdict.js";
import { isDecisiveVerdict } from "./verdict.js";

/**
 * One cascade outcome to feed downstream: the claim ref, its final cascade `Verdict`, and
 * the Layer-1 binding for that claim (so a `supported` verdict without a bound span
 * honestly degrades to `inferred`, never fabricated as `supported`). `binding` is optional:
 * when omitted, the claim is treated as unbound — the conservative direction.
 */
export interface CascadeClaimOutcome {
  ref: string;
  verdict: Verdict;
  binding?: EvidenceBinding | null;
}

/**
 * Map a single cascade `Verdict` (+ its Layer-1 binding) onto the shipped EBV
 * `ClaimVerificationState`. `abstained` and `unverifiable` both project to `unverified`
 * (the review state) — the write-side mirror of the `abstained` inbound alias. `supported`
 * requires a bound span or it degrades to `inferred`.
 */
export function ebvStateFromVerdict(
  verdict: Verdict,
  binding?: EvidenceBinding | null,
): ClaimVerificationState {
  switch (verdict) {
    case "supported":
      return binding?.status === "bound" ? "supported" : "inferred";
    case "contradicted":
      return "contradicted";
    case "unverifiable":
    case "abstained":
      return "unverified";
  }
}

/**
 * True when a claim's cascade verdict routes it to the human triage queue. A claim awaits
 * triage exactly when the cascade did not decisively resolve it — i.e. it is NOT
 * `supported`/`contradicted` (`isDecisiveVerdict`). Both `abstained` (cascade exhausted)
 * and `unverifiable` (span silent) are non-decisions the operator must adjudicate.
 */
export function verdictAwaitsTriage(verdict: Verdict): boolean {
  return !isDecisiveVerdict(verdict);
}

/**
 * The triage-feeder projection of a batch of cascade outcomes. Shape is deliberately
 * narrow: the two numbers the shipped `MakeReadyValidation` consumer needs
 * (`awaitingTriage`, and the abstention subset for honest reporting) plus the per-claim EBV
 * states the graph store persists. It does NOT reconstruct the whole `MakeReadyValidation`
 * (ok/weak/unsupported live in the shipped validation column, not the cascade vocabulary) —
 * it feeds `awaitingTriage` and the EBV states, exactly the PR-0 scope.
 */
export interface TriageFeed {
  /** Per-claim EBV verification state (the graph-store write rows). */
  states: { ref: string; state: ClaimVerificationState }[];
  /** Claims routed to the human triage queue — feeds `MakeReadyValidation.awaitingTriage`. */
  awaitingTriage: number;
  /** Subset of `awaitingTriage` that abstained (cascade exhausted) — honest sub-count. */
  abstained: number;
  /** Refs of the claims awaiting triage, in input order (for re-queue / audit). */
  awaitingTriageRefs: string[];
  /** Per-EBV-state totals — a convenience roll-up over `states`. */
  counts: Record<ClaimVerificationState, number>;
}

/**
 * Project a batch of cascade outcomes into the triage feed. Pure and order-preserving.
 * `awaitingTriage` counts every non-decisive verdict (abstained + unverifiable); the
 * `abstained` sub-count reports how many of those were cascade-exhaustion abstentions.
 */
export function buildTriageFeed(outcomes: readonly CascadeClaimOutcome[]): TriageFeed {
  const counts: Record<ClaimVerificationState, number> = {
    supported: 0,
    inferred: 0,
    unverified: 0,
    contradicted: 0,
    excluded: 0,
  };
  const states: { ref: string; state: ClaimVerificationState }[] = [];
  const awaitingTriageRefs: string[] = [];
  let abstained = 0;
  for (const o of outcomes) {
    const state = ebvStateFromVerdict(o.verdict, o.binding);
    counts[state] += 1;
    states.push({ ref: o.ref, state });
    if (verdictAwaitsTriage(o.verdict)) {
      awaitingTriageRefs.push(o.ref);
      if (o.verdict === "abstained") abstained += 1;
    }
  }
  return {
    states,
    awaitingTriage: awaitingTriageRefs.length,
    abstained,
    awaitingTriageRefs,
    counts,
  };
}
