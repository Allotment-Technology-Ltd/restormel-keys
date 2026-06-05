import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import {
  countGraphUnitsNeedingSourceLink,
  getConnectGraphStats,
  getConnectGraphTargetForWorkspace,
  listConnectDomainPacksForWorkspace,
  listConnectGraphSourcesForWorkspace,
  listConnectIngestJobsForWorkspace,
  listParsedConnectSourceDocumentTextsForWorkspace,
} from "$lib/server/neon";

export type GraphSourceLinkOptions = {
  enabled: boolean;
  unitsNeedingLink: number;
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
  const [stats, target, unitsNeedingLink, graphSources, parsedDocs, jobs] = await Promise.all([
    getConnectGraphStats(workspaceId).catch(() => null),
    getConnectGraphTargetForWorkspace(workspaceId),
    countGraphUnitsNeedingSourceLink(workspaceId).catch(() => 0),
    listConnectGraphSourcesForWorkspace(workspaceId).catch(() => []),
    listParsedConnectSourceDocumentTextsForWorkspace(workspaceId, 200).catch(() => []),
    listConnectIngestJobsForWorkspace({ workspaceId, limit: 20 }).catch(() => []),
  ]);

  if (!stats || stats.units === 0 || !target) return null;

  const jobSourceCount = jobs.reduce((n, job) => n + parseJobSourceCount(job.sources), 0);
  let surrealSourceCount = 0;
  if (target.provider === "surreal") {
    const packs = await listConnectDomainPacksForWorkspace(workspaceId).catch(() => []);
    const packRow = packs[0] ?? null;
    const store = await buildWorkspaceGraphStore(workspaceId);
    if (store && packRow) {
      try {
        const pack = domainPackRecordToApi(packRow);
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
    graphSources.length + parsedDocs.length + jobSourceCount + surrealSourceCount;

  return {
    enabled: candidateSources > 0 || unitsNeedingLink > 0,
    unitsNeedingLink,
    candidateSources,
    totalUnits: stats.units,
  };
}
