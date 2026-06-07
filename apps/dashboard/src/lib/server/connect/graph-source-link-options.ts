import { peekConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import { resolveWorkspaceDomainPack } from "$lib/server/connect/domain-pack-service";
import { countSurrealUnitsNeedingSourceLink } from "$lib/server/connect/graph-source-link-service";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import {
  countGraphUnitsNeedingSourceLink,
  countParsedConnectSourceDocumentsForWorkspace,
  getConnectGraphTargetForWorkspace,
  listConnectGraphSourcesForWorkspace,
  listConnectIngestJobsForWorkspace,
} from "$lib/server/neon";

export type GraphSourceLinkOptions = {
  enabled: boolean;
  unitsNeedingLink: number;
  /** Partial scan or aggregate miss — prefer provenance audit counts when set. */
  estimate?: boolean;
  candidateSources: number;
  totalUnits: number;
};

function parseJobSourceCount(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.filter((r) => r && typeof r === "object" && typeof (r as { text?: string }).text === "string")
    .length;
}

export async function loadGraphSourceLinkOptions(
  workspaceId: string,
): Promise<GraphSourceLinkOptions | null> {
  const [stats, target, graphSources, parsedDocCount, jobs] = await Promise.all([
    peekConnectGraphStats(workspaceId).catch(() => null),
    getConnectGraphTargetForWorkspace(workspaceId),
    listConnectGraphSourcesForWorkspace(workspaceId).catch(() => []),
    countParsedConnectSourceDocumentsForWorkspace(workspaceId).catch(() => 0),
    listConnectIngestJobsForWorkspace({ workspaceId, limit: 20 }).catch(() => []),
  ]);

  let unitsNeedingLink = 0;
  let unitsNeedingLinkEstimate = false;
  if (target?.provider === "surreal") {
    const pack = await resolveWorkspaceDomainPack(workspaceId);
    if (pack) {
      const counted = await countSurrealUnitsNeedingSourceLink(workspaceId, pack).catch(() => ({
        count: 0,
        estimate: false,
      }));
      unitsNeedingLink = counted.count;
      unitsNeedingLinkEstimate = counted.estimate;
    }
  } else {
    unitsNeedingLink = await countGraphUnitsNeedingSourceLink(workspaceId).catch(() => 0);
  }

  if (!stats || stats.units === 0 || !target) return null;

  const jobSourceCount = jobs.reduce((n, job) => n + parseJobSourceCount(job.sources), 0);
  let surrealSourceCount = 0;
  const hasPipelineCatalog = graphSources.length > 0 || parsedDocCount > 0;
  if (target.provider === "surreal" && !hasPipelineCatalog) {
    const pack = await resolveWorkspaceDomainPack(workspaceId);
    const store = await buildWorkspaceGraphStore(workspaceId);
    if (store && pack) {
      try {
        const table = pack.graph_schema.source_table.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const rows = await store.query<{ count?: number }[]>(
          `SELECT count() AS count FROM ${table} GROUP ALL;`,
        );
        surrealSourceCount = Number(rows[0]?.count ?? 0);
      } catch {
        surrealSourceCount = 0;
      }
    }
  }

  const candidateSources =
    graphSources.length + parsedDocCount + jobSourceCount + surrealSourceCount;

  return {
    enabled: candidateSources > 0 || unitsNeedingLink > 0,
    unitsNeedingLink,
    estimate: unitsNeedingLinkEstimate || undefined,
    candidateSources,
    totalUnits: stats.units,
  };
}
