/**
 * Durable pipeline catalog status — survives new browser sessions (unlike sessionStorage).
 */
import { getConnectGraphTargetForWorkspace, countGraphImportedCatalogSources } from "$lib/server/neon";

export type GraphSourceCatalogStatus = {
  pipelineCatalogCount: number;
  /** True when graph-imported source documents already exist in the pipeline catalog. */
  sourcesInPipeline: boolean;
};

export async function loadGraphSourceCatalogStatus(
  workspaceId: string,
): Promise<GraphSourceCatalogStatus> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (!target || target.provider !== "surreal") {
    return { pipelineCatalogCount: 0, sourcesInPipeline: false };
  }
  const pipelineCatalogCount = await countGraphImportedCatalogSources(workspaceId);
  return {
    pipelineCatalogCount,
    sourcesInPipeline: pipelineCatalogCount > 0,
  };
}
