/**
 * EBV read-time freshness enforcement for Connect Retrieve — the serve-time half of
 * "verified is TRUE at query time" (docs/decisions/evidence-bound-verification.md §2).
 *
 * The orchestrator already filters strict retrieval to claims STORED as `supported`
 * (verification_policy.include = ['supported']). That is necessary but not sufficient: a
 * claim bound and judged `supported` weeks ago can rot when its cited source changes. The
 * ADR requires a FRESH deterministic Layer-1 pass at read time before a claim may be
 * served as verified. This module runs that pass over the returned verified-claim envelope
 * and relabels any rotted claim to `unverified` so strict retrieval never serves a stale
 * claim as verified.
 *
 * REUSE, not rebuild: the live, store-aware per-unit recheck is the proven
 * `recheckConnectUnitEvidence` (resolves the current source text from the configured
 * store and runs `verifyEvidenceSpan`). This module only maps its outcome into the pure
 * connect-core decision engine (`decideServedStates`) and projects the result back onto
 * the response envelope + summary. The decision/recompute logic is env-independent and
 * unit-tested with a stub resolver; the live source-text resolution is env-pending.
 *
 * SCOPE (honest): this enforces the STRUCTURED verified contract — `verified_claims` and
 * `verification_summary`, which programmatic `require_verified` consumers (MCP gating,
 * AAIF, agents) gate on. Purging a demoted claim from the rendered `context_block` /
 * `context_pack` is the orchestrator's job (run the recheck BEFORE context assembly, where
 * stale claims are excluded exactly like stored-non-supported ones); that move needs the
 * live store + orchestrator and is ENV-PENDING. When a demotion occurs the response flags
 * `context_block_stale` so consumers know the rendered block predates the recheck.
 */
import type { VerifiedClaimEnvelope, VerifiedClaimSummary, VerifiedClaimState } from "@restormel/contracts";
import {
  decideServedStates,
  summarizeReadTimeRecheck,
  applyDemotionsToSummary,
  buildRecheckAuditRows,
  type ReadTimeRecheckOutcome,
  type ReadTimeRecheckResult,
  type ReadTimeRecheckSummary,
  type ServedClaimRecheck,
} from "@restormel/connect-core";
import type { RecheckOutcome } from "$lib/connect/evidence-dossier";
import { recheckConnectUnitEvidence } from "$lib/server/connect/evidence-dossier-service";

/** Resolve a fresh Layer-1 recheck outcome for one served claim against the live source. */
export type ResolveClaimRecheck = (claimId: string) => Promise<RecheckOutcome>;

/**
 * Map the dossier-service recheck outcome onto the canonical read-time recheck outcome the
 * connect-core engine consumes. The dossier reasons are the deterministic Layer-1 failure
 * modes plus the two read-time-only cases.
 */
export function mapDossierRecheckOutcome(outcome: RecheckOutcome): ReadTimeRecheckOutcome {
  if (outcome.ok) {
    const match = outcome.match === "normalized" || outcome.match === "fuzzy" ? outcome.match : "exact";
    return { ok: true, match };
  }
  switch (outcome.reason) {
    case "hash_mismatch":
      return { ok: false, reason: "stale_source" };
    case "text_changed":
      return { ok: false, reason: "span_lost" };
    case "offsets_out_of_range":
      return { ok: false, reason: "offsets_out_of_range" };
    case "no_bound_span":
      return { ok: false, reason: "no_bound_span" };
    case "source_text_unavailable":
    default:
      return { ok: false, reason: "source_unavailable" };
  }
}

/** Per-state counts over a set of envelopes (the stored verification summary). */
function summarizeEnvelopes(claims: VerifiedClaimEnvelope[]): VerifiedClaimSummary {
  const out: VerifiedClaimSummary = {};
  for (const c of claims) out[c.state] = (out[c.state] ?? 0) + 1;
  return out;
}

const FRESHNESS_GATED: ReadonlySet<VerifiedClaimState> = new Set(["supported", "inferred"]);

export type ReadTimeRecheckApplied = {
  /** verified_claims with every demoted claim relabeled `unverified` (audit chain kept). */
  verifiedClaims: VerifiedClaimEnvelope[];
  /** verification_summary recomputed to the served truth after demotions. */
  verificationSummary: VerifiedClaimSummary;
  /** Per-claim recheck results. */
  results: ReadTimeRecheckResult[];
  /** Aggregate freshness summary (the served-truth recompute, not a stored snapshot). */
  summary: ReadTimeRecheckSummary;
  /** Ids of claims demoted by the read-time pass. */
  demotedIds: string[];
  /** Audit rows for persistence to connect_claim_versions (migration 074). */
  auditRows: { unitId: string; result: string; checkedAt: string }[];
};

/**
 * Apply the read-time recheck to a set of verified-claim envelopes. Pure given `resolve` —
 * inject a stub for tests, the store-backed resolver in production.
 *
 * Only `supported`/`inferred` claims trigger a (potentially expensive) live recheck; every
 * other state passes through untouched and is never promoted.
 */
export async function applyReadTimeRecheckToEnvelopes(args: {
  verifiedClaims: VerifiedClaimEnvelope[];
  resolve: ResolveClaimRecheck;
  now?: Date;
}): Promise<ReadTimeRecheckApplied> {
  const checkedAt = (args.now ?? new Date()).toISOString();

  const served: ServedClaimRecheck[] = [];
  for (const c of args.verifiedClaims) {
    if (FRESHNESS_GATED.has(c.state)) {
      const outcome = mapDossierRecheckOutcome(await args.resolve(c.claim.id));
      served.push({ id: c.claim.id, storedState: c.state, outcome });
    } else {
      // Not freshness-gated — a neutral outcome the engine ignores for these states.
      served.push({ id: c.claim.id, storedState: c.state, outcome: { ok: true, match: "exact" } });
    }
  }

  const results = decideServedStates(served);
  const demoted = new Set(results.filter((r) => r.demoted).map((r) => r.id));

  const verifiedClaims = args.verifiedClaims.map((c) =>
    demoted.has(c.claim.id) ? { ...c, state: "unverified" as VerifiedClaimState } : c,
  );

  const storedSummary = summarizeEnvelopes(args.verifiedClaims);
  const verificationSummary = applyDemotionsToSummary(storedSummary, results) as VerifiedClaimSummary;

  return {
    verifiedClaims,
    verificationSummary,
    results,
    summary: summarizeReadTimeRecheck(results),
    demotedIds: [...demoted],
    auditRows: buildRecheckAuditRows(results, checkedAt),
  };
}

/**
 * Build a store-backed, request-scoped resolver that runs the proven per-unit recheck
 * (`recheckConnectUnitEvidence`) and caches per claim id within the request. A 404 (claim
 * not found in the store) or any error fails CLOSED — reported as `source_text_unavailable`
 * so the claim is demoted rather than served as verified on an unverifiable basis.
 *
 * ENV-PENDING: the live source-text resolution this delegates to needs the configured
 * graph store; end-to-end behaviour is verified only on the integration env.
 */
export function makeUnitRecheckResolver(params: {
  workspaceId: string;
  domainPackId?: string | null;
}): ResolveClaimRecheck {
  const cache = new Map<string, Promise<RecheckOutcome>>();
  return (claimId: string) => {
    let pending = cache.get(claimId);
    if (!pending) {
      pending = recheckConnectUnitEvidence({
        workspaceId: params.workspaceId,
        unitId: claimId,
        domainPackId: params.domainPackId ?? null,
      })
        .then((res): RecheckOutcome =>
          res.ok
            ? res.outcome
            : { ok: false, reason: "source_text_unavailable", checkedAt: new Date().toISOString() },
        )
        .catch((): RecheckOutcome => ({
          ok: false,
          reason: "source_text_unavailable",
          checkedAt: new Date().toISOString(),
        }));
      cache.set(claimId, pending);
    }
    return pending;
  };
}

/**
 * Whether read-time recheck enforcement is active for this server.
 *
 * Canonically this is the RES-113 `onboardingJourney` module-flag cut (REC-ADR-021 §4 —
 * "one big flagged cut"): the new verified-is-true-at-query-time behaviour ships with the
 * onboarding redesign. Connect v1 is a server-side API with no client flag context, so the
 * cut is expressed here as the `CONNECT_READ_TIME_RECHECK` deploy switch, flipped ON
 * together with the onboardingJourney rollout in the integration train. Default OFF →
 * retrieval behaviour is byte-for-byte unchanged (the strict no-op guarantee). It also
 * serves as the ops kill-switch if the live recheck ever needs to be disabled fast.
 */
export function isReadTimeRecheckEnforced(): boolean {
  return process.env.CONNECT_READ_TIME_RECHECK === "1";
}
