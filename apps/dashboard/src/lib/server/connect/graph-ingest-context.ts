/**
 * Lightweight graph snapshot for pack-weighted ingest prompts (Phase 0c).
 */
import type { GraphIngestContext } from "@restormel/connect-core";
import { getConnectGraphStats } from "$lib/server/neon";

export async function loadGraphIngestContext(workspaceId: string): Promise<GraphIngestContext> {
  const stats = await getConnectGraphStats(workspaceId).catch(() => null);
  if (!stats || stats.units === 0) {
    return {
      unitCount: 0,
      topUnitTypes: [],
      relationCount: 0,
      isGreenfield: true,
    };
  }
  return {
    unitCount: stats.units,
    topUnitTypes: [],
    relationCount: stats.relations,
    isGreenfield: false,
  };
}
