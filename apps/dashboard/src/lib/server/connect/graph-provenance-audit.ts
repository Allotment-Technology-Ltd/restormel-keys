/**
 * Fast Surreal-native provenance audit — O(1) aggregates, not a 34k idea scan.
 */
import { peekConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import { loadGraphSourceCatalogStatus } from "$lib/server/connect/graph-source-catalog-status";
import { resolveWorkspaceDomainPack } from "$lib/server/connect/domain-pack-service";
import {
  loadSurrealProvenanceAggregateCounts,
  resolveSurrealUnitTableForProvenance,
} from "$lib/server/connect/graph-surreal-provenance-counts";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import {
  countGraphUnitsNeedingSourceLink,
  getConnectGraphTargetForWorkspace,
} from "$lib/server/neon";

export type GraphProvenanceVerdict =
  | "native"
  | "needs_edge_repair"
  | "empty"
  | "unavailable"
  | "unknown";

export type GraphProvenanceAudit = {
  store: "surreal" | "postgres" | "none";
  totalUnits: number;
  /** Ideas with a bibliographic `source` edge in the graph (not legacy). */
  graphLinked: number;
  /** Ideas with no `source` record id. */
  unlinked: number;
  /** Ideas pointing at legacy / placeholder source records. */
  legacyPlaceholder: number;
  /** Ideas that still need text-matching repair (unlinked + legacy). */
  needsEdgeRepair: number;
  /** Graph-imported sources in the Keys pipeline catalog (validation cache). */
  pipelineCatalogSources: number;
  verdict: GraphProvenanceVerdict;
  /** Human-readable one-liner for the audit strip. */
  headline: string;
};

export function deriveProvenanceVerdict(args: {
  totalUnits: number;
  needsEdgeRepair: number;
  store: GraphProvenanceAudit["store"];
  aggregatesOk?: boolean;
}): GraphProvenanceVerdict {
  if (args.store === "none") return "unavailable";
  if (args.totalUnits === 0) return "empty";
  if (args.aggregatesOk === false) return "unknown";
  if (args.needsEdgeRepair === 0) return "native";
  return "needs_edge_repair";
}

export function provenanceAuditHeadline(args: {
  verdict: GraphProvenanceVerdict;
  graphLinked: number;
  needsEdgeRepair: number;
  pipelineCatalogSources: number;
  store: GraphProvenanceAudit["store"];
}): string {
  if (args.verdict === "empty") return "No ideas in the graph store yet.";
  if (args.verdict === "unavailable") return "Connect a graph store to audit provenance.";
  if (args.verdict === "unknown") {
    return "Could not read Surreal provenance counts — refresh graph stats and retry.";
  }
  if (args.verdict === "native") {
    return args.pipelineCatalogSources > 0
      ? `${args.graphLinked.toLocaleString()} ideas use graph-native source links — pipeline catalog ready for validation.`
      : `${args.graphLinked.toLocaleString()} ideas use graph-native source links — import sources into the pipeline catalog before validation.`;
  }
  return `${args.needsEdgeRepair.toLocaleString()} idea${args.needsEdgeRepair === 1 ? "" : "s"} need source-edge repair; ${args.graphLinked.toLocaleString()} already graph-linked.`;
}

export async function loadGraphProvenanceAudit(
  workspaceId: string,
): Promise<GraphProvenanceAudit | null> {
  const [stats, target, catalog] = await Promise.all([
    peekConnectGraphStats(workspaceId).catch(() => null),
    getConnectGraphTargetForWorkspace(workspaceId),
    loadGraphSourceCatalogStatus(workspaceId).catch(() => ({
      pipelineCatalogCount: 0,
      sourcesInPipeline: false,
    })),
  ]);

  const pipelineCatalogSources = catalog.pipelineCatalogCount;

  if (!target) {
    return {
      store: "none",
      totalUnits: 0,
      graphLinked: 0,
      unlinked: 0,
      legacyPlaceholder: 0,
      needsEdgeRepair: 0,
      pipelineCatalogSources,
      verdict: "unavailable",
      headline: provenanceAuditHeadline({
        verdict: "unavailable",
        graphLinked: 0,
        needsEdgeRepair: 0,
        pipelineCatalogSources,
        store: "none",
      }),
    };
  }

  const totalUnits = stats?.units ?? 0;
  const storeType = target.provider === "surreal" ? "surreal" : "postgres";

  if (target.provider === "surreal") {
    const pack = await resolveWorkspaceDomainPack(workspaceId);
    const graphStore = await buildWorkspaceGraphStore(workspaceId);

    if (!graphStore) {
      return {
        store: storeType,
        totalUnits,
        graphLinked: 0,
        unlinked: 0,
        legacyPlaceholder: 0,
        needsEdgeRepair: 0,
        pipelineCatalogSources,
        verdict: totalUnits === 0 ? "empty" : "unavailable",
        headline: provenanceAuditHeadline({
          verdict: totalUnits === 0 ? "empty" : "unavailable",
          graphLinked: 0,
          needsEdgeRepair: 0,
          pipelineCatalogSources,
          store: storeType,
        }),
      };
    }

    const { unitTable } = await resolveSurrealUnitTableForProvenance(graphStore, pack, {
      totalUnitsHint: totalUnits > 0 ? totalUnits : undefined,
    });

    if (!unitTable) {
      const verdict = deriveProvenanceVerdict({
        totalUnits,
        needsEdgeRepair: 0,
        store: storeType,
        aggregatesOk: false,
      });
      return {
        store: storeType,
        totalUnits,
        graphLinked: 0,
        unlinked: 0,
        legacyPlaceholder: 0,
        needsEdgeRepair: 0,
        pipelineCatalogSources,
        verdict,
        headline: provenanceAuditHeadline({
          verdict,
          graphLinked: 0,
          needsEdgeRepair: 0,
          pipelineCatalogSources,
          store: storeType,
        }),
      };
    }

    const aggregates = await loadSurrealProvenanceAggregateCounts(graphStore, unitTable);
    const resolvedTotal = totalUnits > 0 ? totalUnits : aggregates.totalUnits;
    const needsEdgeRepair = aggregates.needsEdgeRepair;
    const graphLinked = aggregates.graphLinked;
    const verdict = deriveProvenanceVerdict({
      totalUnits: resolvedTotal,
      needsEdgeRepair,
      store: storeType,
      aggregatesOk: aggregates.aggregatesOk,
    });

    return {
      store: storeType,
      totalUnits: resolvedTotal,
      graphLinked,
      unlinked: aggregates.unlinked,
      legacyPlaceholder: aggregates.legacyPlaceholder,
      needsEdgeRepair,
      pipelineCatalogSources,
      verdict,
      headline: provenanceAuditHeadline({
        verdict,
        graphLinked,
        needsEdgeRepair,
        pipelineCatalogSources,
        store: storeType,
      }),
    };
  }

  const needsEdgeRepair = await countGraphUnitsNeedingSourceLink(workspaceId).catch(() => 0);
  const graphLinked = Math.max(0, totalUnits - needsEdgeRepair);
  const verdict = deriveProvenanceVerdict({ totalUnits, needsEdgeRepair, store: storeType });

  return {
    store: storeType,
    totalUnits,
    graphLinked,
    unlinked: needsEdgeRepair,
    legacyPlaceholder: 0,
    needsEdgeRepair,
    pipelineCatalogSources,
    verdict,
    headline: provenanceAuditHeadline({
      verdict,
      graphLinked,
      needsEdgeRepair,
      pipelineCatalogSources,
      store: storeType,
    }),
  };
}
