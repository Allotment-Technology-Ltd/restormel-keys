/**
 * Stage 3.2 — incremental re-ingest wiring helpers (pure — testable without a store).
 * (docs/decisions/verified-memory-incremental-ingest.md, signed off 2026-06-10)
 *
 * The full-mode runner uses these to turn a deterministic re-ingest plan (carried /
 * changed / added / removed, from @restormel/connect-core's planIncrementalReingest)
 * into writer calls:
 *   - claim-version bindings for setEvidence (claim_key + version_no + carry-forward
 *     verification state for unchanged claims — zero re-judging);
 *   - supersession rows that close the old versions' validity windows and chain
 *     superseded_by to the new version row (null for removed claims);
 *   - reversible soft-exclusions for the replaced/removed PRIOR unit records (the
 *     remediation soft-exclude semantics: hidden from retrieval, never hard-deleted).
 *
 * Unit-record ids are never reshaped here (readiness-runs cohort invariant).
 */
import type { ConnectSourceProvenance } from "@restormel/contracts/connect";
import {
  computeClaimKey,
  deriveClaimSourceKey,
  type NextClaim,
  type ReingestPlan,
} from "@restormel/connect-core";
import type { ClaimVersionBinding } from "$lib/server/connect/graph-writer";
import type { EvidenceRow, StateRow } from "$lib/server/connect/evidence-persist";

/** Soft-exclusion note prefix for superseded prior units (greppable in audits). */
export const SUPERSEDED_NOTE_PREFIX = "Superseded (re-ingest)";

/** Stable cross-run identity of an ingest source (canonical url → url → title). */
export function sourceKeyForIngestSource(src: {
  url?: string;
  title?: string;
  provenance?: ConnectSourceProvenance;
}): string {
  return deriveClaimSourceKey({
    canonicalUrl: src.provenance?.canonical_url ?? null,
    url: src.provenance?.url ?? src.url ?? null,
    title: src.provenance?.title ?? src.title ?? null,
  });
}

/** Compute deterministic claim identities for every stored unit of one source. */
export async function computeNextClaims(args: {
  sourceKey: string;
  rows: EvidenceRow[];
}): Promise<NextClaim[]> {
  const next: NextClaim[] = [];
  for (const row of args.rows) {
    next.push({
      unitId: row.unitId,
      text: row.text,
      claimKey: await computeClaimKey({
        sourceKey: args.sourceKey,
        evidenceQuote: row.quote,
        text: row.text,
      }),
    });
  }
  return next;
}

/**
 * Annotate evidence rows with claim identity + version metadata per the plan.
 * Carried claims copy their prior verification state (no re-judging); carried and
 * changed claims take prior version + 1; new claims start at version 1.
 */
export function buildClaimVersionBindings(args: {
  rows: EvidenceRow[];
  next: NextClaim[];
  plan: ReingestPlan;
}): ClaimVersionBinding[] {
  const claimKeyByUnitId = new Map(args.next.map((n) => [n.unitId, n.claimKey]));
  const carriedByUnitId = new Map(args.plan.carried.map((c) => [c.next.unitId, c.prior]));
  const changedByUnitId = new Map(args.plan.changed.map((c) => [c.next.unitId, c.prior]));
  return args.rows.map((row) => {
    const carried = carriedByUnitId.get(row.unitId);
    const changed = changedByUnitId.get(row.unitId);
    const prior = carried ?? changed;
    return {
      unitId: row.unitId,
      text: row.text,
      binding: row.binding,
      claimKey: claimKeyByUnitId.get(row.unitId) ?? null,
      versionNo: prior ? prior.versionNo + 1 : 1,
      carried: carried
        ? {
            verificationState: carried.verificationState ?? "unverified",
            judgedBy: carried.judgedBy,
            judgedAt: carried.judgedAt,
          }
        : null,
    };
  });
}

/**
 * Close the validity windows of every prior version the plan replaced or removed.
 * Replaced versions chain superseded_by → the NEW version row id; removed versions
 * close with no successor. Reversible — version rows are never deleted.
 */
export function buildSupersessionRows(args: {
  plan: ReingestPlan;
  versionIdByUnitId: Map<string, string>;
}): { versionId: string; supersededBy: string | null }[] {
  const rows: { versionId: string; supersededBy: string | null }[] = [];
  for (const { next, prior } of [...args.plan.carried, ...args.plan.changed]) {
    rows.push({
      versionId: prior.versionId,
      supersededBy: args.versionIdByUnitId.get(next.unitId) ?? null,
    });
  }
  for (const prior of args.plan.removed) {
    rows.push({ versionId: prior.versionId, supersededBy: null });
  }
  return rows;
}

/**
 * Reversible soft-exclusions for the PRIOR unit records the plan replaced or removed —
 * the new version's unit carries the live claim; the old unit stays in the store,
 * out of retrieval (same semantics as remediation soft-exclude, never a hard delete).
 */
export function buildSupersededUnitExclusions(
  plan: ReingestPlan,
): { unitId: string; note: string }[] {
  return [
    ...plan.carried.map(({ prior }) => ({
      unitId: prior.unitId,
      note: `${SUPERSEDED_NOTE_PREFIX}: claim carried forward to v${prior.versionNo + 1}`,
    })),
    ...plan.changed.map(({ prior }) => ({
      unitId: prior.unitId,
      note: `${SUPERSEDED_NOTE_PREFIX}: claim changed — re-validated as v${prior.versionNo + 1}`,
    })),
    ...plan.removed.map((prior) => ({
      unitId: prior.unitId,
      note: `${SUPERSEDED_NOTE_PREFIX}: claim no longer present in the re-ingested source`,
    })),
  ];
}

/**
 * Carry-forward rows for the new units of unchanged claims: verification state (for the
 * claim-version/EBV surface) and the unit-level validation verdict, both copied from the
 * prior version — no model calls.
 */
export function buildCarriedStateRows(plan: ReingestPlan): {
  states: StateRow[];
  validations: { unitId: string; status: string; note: string | null }[];
} {
  const states: StateRow[] = [];
  const validations: { unitId: string; status: string; note: string | null }[] = [];
  for (const { next, prior } of plan.carried) {
    states.push({
      unitId: next.unitId,
      state: (prior.verificationState ?? "unverified") as StateRow["state"],
      judgedBy: prior.judgedBy,
    });
    if (prior.validationStatus) {
      validations.push({
        unitId: next.unitId,
        status: prior.validationStatus,
        note: prior.validationNote,
      });
    }
  }
  return { states, validations };
}
