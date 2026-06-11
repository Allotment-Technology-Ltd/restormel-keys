/**
 * Stage 3.3 — temporal validity + as-of retrieval (verified-memory ADR §2,
 * docs/decisions/verified-memory-incremental-ingest.md).
 *
 * Projects a retrieved subgraph onto an instant in time using the claim-version chains
 * the Postgres spine persists (connect_claim_versions): each retrieved claim's identity
 * chain is resolved, and the version whose validity window contains `as_of`
 * (`valid_from ≤ t < valid_to`) is served — the current version when it was already
 * valid, an OLDER version (its recorded text + verification state) when the claim has
 * since been superseded, or nothing when the claim did not exist at `t`. The audit flag
 * (`include_superseded`) instead returns every version of each retrieved chain with its
 * recorded state and validity window.
 *
 * Honesty rules (the product's whole point):
 *   - Stores without version chains DEGRADE EXPLICITLY. BYO Surreal stores carry no
 *     chains until the Stage 3.2b user opt-in — `applied: false` +
 *     `degraded_reason: "surreal_version_chains_unavailable"`, claims returned
 *     unfiltered. Never silently pretend current data is as-of data.
 *   - Claims with no version rows (legacy/pre-versioning) are KEPT and counted in
 *     `unversioned_claims` — unknown validity is flagged, never silently filtered and
 *     never presumed valid (ADR migration rule: never silently demote, never silently
 *     keep).
 *   - Unit-record ids are never reshaped (readiness-runs cohort invariant): substituted
 *     versions are served under their original prior unit ids.
 */
import type { ConnectTemporalMetadata } from "@restormel/contracts/connect";
import type { VerifiedClaimVersion } from "@restormel/contracts";
import type { CuratedSubgraph, RetrievedClaim } from "@restormel/graphrag-core";
import {
  listConnectClaimVersionChainsForUnitsPostgres,
  type ConnectClaimVersionChainRow,
} from "$lib/server/neon";

export type { ConnectClaimVersionChainRow } from "$lib/server/neon";

/** Parsed temporal request; null when the caller asked for nothing temporal. */
export type TemporalRequest = { asOf: string | null; includeSuperseded: boolean };

export function parseTemporalRequest(req: {
  as_of?: string;
  include_superseded?: boolean;
}): TemporalRequest | null {
  if (!req.as_of && !req.include_superseded) return null;
  return { asOf: req.as_of ?? null, includeSuperseded: req.include_superseded === true };
}

export type TemporalProjectionStats = {
  excluded: number;
  substituted: number;
  supersededReturned: number;
  unversioned: number;
};

export type TemporalProjection = {
  subgraph: CuratedSubgraph;
  /** Per returned claim id (unit id): validity window for the envelope's version block. */
  versionsByClaimId: Map<string, VerifiedClaimVersion>;
  stats: TemporalProjectionStats;
  /** True when the claim set differs from the input (context block must be rebuilt). */
  changed: boolean;
};

/** A chain groups every version of one claim identity (claim_key; unit id for legacy rows). */
function chainIdFor(row: ConnectClaimVersionChainRow): string {
  return row.claimKey ? `key:${row.claimKey}` : `unit:${row.unitId}`;
}

/** Envelope version block from a version row (contract: verified-claim.ts). */
export function versionMetaFromRow(row: ConnectClaimVersionChainRow): VerifiedClaimVersion {
  return {
    valid_from: row.validFrom,
    valid_to: row.validTo,
    superseded_by: row.supersededBy,
    version_no: row.versionNo,
  };
}

/** ADR §2 window test: `valid_from ≤ t < valid_to` (open-ended when valid_to is null). */
export function versionValidAt(row: ConnectClaimVersionChainRow, t: Date): boolean {
  const ms = t.getTime();
  const from = new Date(row.validFrom).getTime();
  const to = row.validTo ? new Date(row.validTo).getTime() : Number.POSITIVE_INFINITY;
  return from <= ms && ms < to;
}

/**
 * Serve a (typically superseded) version row as a claim node: recorded text and
 * verification state come from the version; descriptive fields (type/domain/source)
 * are inherited from the retrieved chain sibling. Trust score and verification
 * category are NOT inherited — they describe the current version, and claiming them
 * for an older one would be silent promotion.
 */
function claimFromVersionRow(
  template: RetrievedClaim,
  row: ConnectClaimVersionChainRow,
): RetrievedClaim {
  return {
    ...template,
    id: row.unitId,
    text: row.text,
    verification_state: row.verificationState ?? null,
    verification_category: undefined,
    trust_score: null,
  };
}

/**
 * Pure as-of / audit projection of a retrieved subgraph against its version chains.
 * Relations are re-indexed when claims drop; audit-only versions are appended without
 * relations (the graph edges belong to current units).
 */
export function projectTemporalValidity(args: {
  subgraph: CuratedSubgraph;
  rows: ConnectClaimVersionChainRow[];
  asOf: Date | null;
  includeSuperseded: boolean;
}): TemporalProjection {
  const { subgraph, rows, asOf, includeSuperseded } = args;

  // Rows arrive id-ordered (chronological): last write per unit wins as its "latest".
  const latestByUnit = new Map<string, ConnectClaimVersionChainRow>();
  const chains = new Map<string, ConnectClaimVersionChainRow[]>();
  for (const row of rows) {
    latestByUnit.set(row.unitId, row);
    const chainId = chainIdFor(row);
    const chain = chains.get(chainId);
    if (chain) chain.push(row);
    else chains.set(chainId, [row]);
  }

  const versionsByClaimId = new Map<string, VerifiedClaimVersion>();
  const stats: TemporalProjectionStats = {
    excluded: 0,
    substituted: 0,
    supersededReturned: 0,
    unversioned: 0,
  };

  const kept: RetrievedClaim[] = [];
  const indexMap = new Map<number, number>();
  const auditAppend: RetrievedClaim[] = [];
  const retrievedUnitIds = new Set(subgraph.claims.map((c) => c.id));
  const appendedUnitIds = new Set<string>();

  subgraph.claims.forEach((claim, i) => {
    const row = latestByUnit.get(claim.id);
    if (!row) {
      // Legacy/pre-versioning unit: validity unknown — keep and FLAG, never filter silently.
      stats.unversioned += 1;
      indexMap.set(i, kept.length);
      kept.push(claim);
      return;
    }
    versionsByClaimId.set(claim.id, versionMetaFromRow(row));
    const chain = chains.get(chainIdFor(row)) ?? [row];

    if (includeSuperseded) {
      // Audit view: the retrieved claim plus every other version of its chain, each
      // carrying its recorded state + validity window. as_of does not drop here — the
      // audit flag exists precisely to see the whole history.
      indexMap.set(i, kept.length);
      kept.push(claim);
      for (const v of chain) {
        if (v.unitId === claim.id) continue;
        if (retrievedUnitIds.has(v.unitId) || appendedUnitIds.has(v.unitId)) continue;
        appendedUnitIds.add(v.unitId);
        versionsByClaimId.set(v.unitId, versionMetaFromRow(v));
        auditAppend.push(claimFromVersionRow(claim, v));
        stats.supersededReturned += 1;
      }
      return;
    }

    if (!asOf) {
      indexMap.set(i, kept.length);
      kept.push(claim);
      return;
    }

    const valid = chain.find((v) => versionValidAt(v, asOf));
    if (!valid) {
      // No version of this claim existed at as_of (born later, or removed earlier).
      stats.excluded += 1;
      return;
    }
    if (valid.unitId === claim.id) {
      indexMap.set(i, kept.length);
      kept.push(claim);
      return;
    }
    // The chain was on an OLDER version at as_of — serve that version's recorded content.
    stats.substituted += 1;
    versionsByClaimId.set(valid.unitId, versionMetaFromRow(valid));
    indexMap.set(i, kept.length);
    kept.push(claimFromVersionRow(claim, valid));
  });

  const relations = subgraph.relations
    .filter((r) => indexMap.has(r.from_index) && indexMap.has(r.to_index))
    .map((r) => ({
      ...r,
      from_index: indexMap.get(r.from_index) as number,
      to_index: indexMap.get(r.to_index) as number,
    }));

  const claims = [...kept, ...auditAppend];
  const changed = claims.length !== subgraph.claims.length || stats.substituted > 0;
  return {
    subgraph: { ...subgraph, claims, relations },
    versionsByClaimId,
    stats,
    changed,
  };
}

export type TemporalValidityOutcome = {
  subgraph: CuratedSubgraph;
  versionsByClaimId: Map<string, VerifiedClaimVersion>;
  metadata: ConnectTemporalMetadata;
  changed: boolean;
};

/**
 * Load version chains and apply the temporal projection for one retrieval response.
 *
 * Store capability is decided by provider, not by data shape:
 *   - postgres → chains live in the Restormel-owned spine (connect_claim_versions);
 *     the projection runs.
 *   - surreal  → BYO stores have NO version chains until Stage 3.2b (user opt-in to a
 *     Restormel-managed restormel_claim_versions table in their database). Degrade
 *     explicitly; the response says so. NEVER silently serve current data as as-of.
 *   - none     → no graph target; nothing to consult.
 *
 * Never throws: a chain-lookup failure degrades to `version_lookup_failed`.
 */
export async function applyTemporalValidity(args: {
  workspaceId: string;
  provider: string | null;
  subgraph: CuratedSubgraph;
  request: TemporalRequest;
  /** Injectable for tests; defaults to the Postgres spine chain lookup. */
  loadChains?: (unitIds: string[]) => Promise<ConnectClaimVersionChainRow[]>;
}): Promise<TemporalValidityOutcome> {
  const base: ConnectTemporalMetadata = {
    as_of: args.request.asOf,
    applied: false,
    include_superseded: args.request.includeSuperseded,
  };
  const unchanged = (degraded_reason: NonNullable<ConnectTemporalMetadata["degraded_reason"]>) => ({
    subgraph: args.subgraph,
    versionsByClaimId: new Map<string, VerifiedClaimVersion>(),
    metadata: { ...base, degraded_reason },
    changed: false,
  });

  if (!args.provider) return unchanged("graph_target_not_configured");
  if (args.provider !== "postgres") return unchanged("surreal_version_chains_unavailable");

  let rows: ConnectClaimVersionChainRow[];
  try {
    const load =
      args.loadChains ??
      ((unitIds: string[]) =>
        listConnectClaimVersionChainsForUnitsPostgres({
          workspaceId: args.workspaceId,
          unitIds,
        }));
    rows = await load(args.subgraph.claims.map((c) => c.id));
  } catch {
    return unchanged("version_lookup_failed");
  }

  const projection = projectTemporalValidity({
    subgraph: args.subgraph,
    rows,
    asOf: args.request.asOf ? new Date(args.request.asOf) : null,
    includeSuperseded: args.request.includeSuperseded,
  });
  return {
    subgraph: projection.subgraph,
    versionsByClaimId: projection.versionsByClaimId,
    metadata: {
      ...base,
      applied: true,
      excluded_claims: projection.stats.excluded,
      substituted_claims: projection.stats.substituted,
      superseded_claims_returned: projection.stats.supersededReturned,
      unversioned_claims: projection.stats.unversioned,
    },
    changed: projection.changed,
  };
}
