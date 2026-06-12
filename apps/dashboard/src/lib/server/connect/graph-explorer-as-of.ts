/**
 * W2.5 — as-of time travel for the Connect graph explorer.
 *
 * The explorer reads CURRENT units from the workspace's active graph store. This module
 * projects a page of those units onto a past instant (`as_of`) using the claim-version
 * chains the Postgres spine persists (`connect_claim_versions`), reusing the SAME
 * boundary semantics as the connect-v1 retrieve path (`versionValidAt`: valid_from ≤ t <
 * valid_to — a claim valid until T is shown at T-ε, not at T).
 *
 * Store capability is decided by PROVIDER, not by data shape — identical to
 * `applyTemporalValidity` (connect-v1/temporal-validity.ts):
 *   - postgres  → version chains live in the Restormel-owned spine; the projection runs.
 *   - surreal   → BYO stores carry NO chains until the Stage 3.2b user opt-in. Degrade
 *                 EXPLICITLY (`surreal_version_chains_unavailable`); units returned live.
 *   - none      → no graph target; nothing to consult.
 *
 * Honesty rules (the product's whole point — never fabricate a historical view):
 *   - A store that cannot answer as-of returns `applied: false` + a `reason`, with the
 *     CURRENT units unchanged. The UI shows "history not available for this graph",
 *     never the live data dressed up as past data.
 *   - Units with no version rows (legacy/pre-versioning) are KEPT and counted in
 *     `unversioned` — unknown validity is flagged, never silently filtered, never
 *     presumed valid.
 *   - Substituted (older) versions are served under their ORIGINAL prior unit ids
 *     (readiness-runs cohort invariant — unit ids are never reshaped).
 *
 * This is a READ projection: it issues ZERO mutations (the explorer mutation-fetch pin
 * at 16 must not move — as-of is a view feature).
 */
import {
  versionValidAt,
  type ConnectClaimVersionChainRow,
} from "$lib/server/connect-v1/temporal-validity";
import { listConnectClaimVersionChainsForUnitsPostgres } from "$lib/server/neon";
import type { ConnectGraphUnitView } from "$lib/server/connect/graph-explorer-service";
import { VERIFICATION_STATES, type VerificationState } from "$lib/connect/evidence-dossier";

/** Narrow a free-text verification_state string from a version row to the EBV union, or null. */
function asVerificationState(s: string | null): VerificationState | null {
  return s && (VERIFICATION_STATES as readonly string[]).includes(s) ? (s as VerificationState) : null;
}

/** Why an as-of view could not be applied (mirrors ConnectTemporalMetadata.degraded_reason). */
export type AsOfDegradedReason =
  | "graph_target_not_configured"
  | "surreal_version_chains_unavailable"
  | "version_lookup_failed";

/** Honest report of whether the requested as-of view was applied, and what it changed. */
export type AsOfStatus =
  | {
      requested: true;
      applied: true;
      asOf: string;
      includeSuperseded: boolean;
      /** Units that did not exist at the instant (born later / removed earlier). */
      excluded: number;
      /** Units served as an OLDER version of their chain. */
      substituted: number;
      /** Extra superseded versions appended under the audit flag. */
      supersededReturned: number;
      /** Units with no version row — validity unknown, kept and flagged. */
      unversioned: number;
    }
  | {
      requested: true;
      applied: false;
      asOf: string | null;
      includeSuperseded: boolean;
      reason: AsOfDegradedReason;
    }
  | { requested: false };

export type AsOfProjectionResult = {
  units: ConnectGraphUnitView[];
  asOfStatus: AsOfStatus;
};

export type AsOfRequest = {
  /** Canonical ISO instant, or null for a pure include-superseded audit view. */
  asOf: string | null;
  includeSuperseded: boolean;
};

/** Parse the units-API as-of query params into a request, or null when nothing was asked. */
export function parseAsOfRequestFromQuery(get: (k: string) => string | null): AsOfRequest | null {
  const asOfRaw = get("as_of")?.trim() ?? "";
  const includeSuperseded = (get("audit")?.trim() ?? "") === "1";
  if (!asOfRaw && !includeSuperseded) return null;
  if (asOfRaw) {
    const t = new Date(asOfRaw);
    if (Number.isNaN(t.getTime())) {
      // Unparseable instant → treat as "no as_of" but keep an audit flag if present.
      return includeSuperseded ? { asOf: null, includeSuperseded: true } : null;
    }
    return { asOf: t.toISOString(), includeSuperseded };
  }
  return { asOf: null, includeSuperseded: true };
}

/** Serve a (superseded) version row as a unit view: recorded text + state from the row. */
function unitFromVersionRow(
  template: ConnectGraphUnitView,
  row: ConnectClaimVersionChainRow,
): ConnectGraphUnitView {
  const recordedState = asVerificationState(row.verificationState);
  return {
    ...template,
    id: row.unitId,
    text: row.text,
    // Mark this as a prior version served historically: the UI labels its (neutralized)
    // verdict/provenance as "current verdict — not historical" rather than as verdict-at-t.
    asOfHistorical: true,
    // The TODAY-ONLY triage/provenance fields are reconstructible from NO version row —
    // operator reviews write `connect_claim_versions` no rows, and the source binding on
    // the CURRENT unit describes today's claim, not this older version. Carrying the
    // template's June `validationStatus`/`validationNote`/source/author onto a May row
    // would be silent promotion of current triage as historical (the same instinct the
    // module already applies to `evidence`). Neutralize them; the UI labels the verdict
    // as "current verdict — not historical" rather than fabricating a verdict-at-t.
    validationStatus: null,
    validationNote: null,
    sourceTitle: null,
    sourceUrl: null,
    sourceKind: null,
    author: null,
    // The version row carries the EBV verification state + judge attribution recorded at
    // that time. The CURRENT-version evidence binding/dossier does NOT describe this older
    // version, so the span/judge/versions are left null (claiming them for a prior version
    // would be silent promotion). We surface only what the version row actually recorded.
    evidence: recordedState
      ? {
          verificationState: recordedState,
          evidenceStatus: null,
          evidence: null,
          judgedBy: row.judgedBy,
          judgedAt: row.judgedAt,
          judge: null,
          versions: null,
          boundAt: null,
        }
      : null,
  };
}

/**
 * Pure projection of a units page onto an instant given its version-chain rows.
 * Exported for unit tests (the boundary case is the headline assertion).
 */
export function projectUnitsAsOf(args: {
  units: ConnectGraphUnitView[];
  rows: ConnectClaimVersionChainRow[];
  asOf: Date | null;
  includeSuperseded: boolean;
}): { units: ConnectGraphUnitView[]; excluded: number; substituted: number; supersededReturned: number; unversioned: number } {
  const { units, rows, asOf, includeSuperseded } = args;

  // Rows arrive id-ordered (chronological): last write per unit wins as its "latest".
  const latestByUnit = new Map<string, ConnectClaimVersionChainRow>();
  const chains = new Map<string, ConnectClaimVersionChainRow[]>();
  const chainIdFor = (row: ConnectClaimVersionChainRow) =>
    row.claimKey ? `key:${row.claimKey}` : `unit:${row.unitId}`;
  for (const row of rows) {
    latestByUnit.set(row.unitId, row);
    const id = chainIdFor(row);
    const chain = chains.get(id);
    if (chain) chain.push(row);
    else chains.set(id, [row]);
  }

  const kept: ConnectGraphUnitView[] = [];
  const auditAppend: ConnectGraphUnitView[] = [];
  const presentIds = new Set(units.map((u) => u.id));
  const appendedIds = new Set<string>();
  let excluded = 0;
  let substituted = 0;
  let supersededReturned = 0;
  let unversioned = 0;

  for (const unit of units) {
    const row = latestByUnit.get(unit.id);
    if (!row) {
      // Legacy/pre-versioning unit: validity unknown — keep and FLAG, never filter.
      unversioned += 1;
      kept.push(unit);
      continue;
    }
    const chain = chains.get(chainIdFor(row)) ?? [row];

    if (includeSuperseded) {
      kept.push(unit);
      for (const v of chain) {
        if (v.unitId === unit.id) continue;
        if (presentIds.has(v.unitId) || appendedIds.has(v.unitId)) continue;
        appendedIds.add(v.unitId);
        auditAppend.push(unitFromVersionRow(unit, v));
        supersededReturned += 1;
      }
      continue;
    }

    if (!asOf) {
      kept.push(unit);
      continue;
    }

    const valid = chain.find((v) => versionValidAt(v, asOf));
    if (!valid) {
      // No version of this claim existed at as_of (born later, or removed earlier).
      excluded += 1;
      continue;
    }
    if (valid.unitId === unit.id) {
      kept.push(unit);
      continue;
    }
    // The chain was on an OLDER version at as_of — serve that version's recorded content.
    substituted += 1;
    kept.push(unitFromVersionRow(unit, valid));
  }

  return {
    units: [...kept, ...auditAppend],
    excluded,
    substituted,
    supersededReturned,
    unversioned,
  };
}

/**
 * Apply an as-of / audit projection to a page of explorer units for one workspace.
 *
 * Never throws: a chain-lookup failure degrades to `version_lookup_failed` and returns
 * the CURRENT units (honest degrade, never a fabricated past view).
 */
export async function applyExplorerAsOf(args: {
  workspaceId: string;
  provider: string | null;
  units: ConnectGraphUnitView[];
  request: AsOfRequest | null;
  /** Injectable for tests; defaults to the Postgres spine chain lookup. */
  loadChains?: (unitIds: string[]) => Promise<ConnectClaimVersionChainRow[]>;
}): Promise<AsOfProjectionResult> {
  const { workspaceId, provider, units, request } = args;
  if (!request) return { units, asOfStatus: { requested: false } };

  const degraded = (reason: AsOfDegradedReason): AsOfProjectionResult => ({
    units,
    asOfStatus: {
      requested: true,
      applied: false,
      asOf: request.asOf,
      includeSuperseded: request.includeSuperseded,
      reason,
    },
  });

  if (!provider) return degraded("graph_target_not_configured");
  if (provider !== "postgres") return degraded("surreal_version_chains_unavailable");
  if (units.length === 0) {
    // Nothing on this page to project, but the request was honoured against an empty set.
    return {
      units,
      asOfStatus: {
        requested: true,
        applied: true,
        asOf: request.asOf ?? "",
        includeSuperseded: request.includeSuperseded,
        excluded: 0,
        substituted: 0,
        supersededReturned: 0,
        unversioned: 0,
      },
    };
  }

  let rows: ConnectClaimVersionChainRow[];
  try {
    const load =
      args.loadChains ??
      ((unitIds: string[]) =>
        listConnectClaimVersionChainsForUnitsPostgres({ workspaceId, unitIds }));
    rows = await load(units.map((u) => u.id));
  } catch {
    return degraded("version_lookup_failed");
  }

  const projection = projectUnitsAsOf({
    units,
    rows,
    asOf: request.asOf ? new Date(request.asOf) : null,
    includeSuperseded: request.includeSuperseded,
  });

  return {
    units: projection.units,
    asOfStatus: {
      requested: true,
      applied: true,
      asOf: request.asOf ?? "",
      includeSuperseded: request.includeSuperseded,
      excluded: projection.excluded,
      substituted: projection.substituted,
      supersededReturned: projection.supersededReturned,
      unversioned: projection.unversioned,
    },
  };
}
