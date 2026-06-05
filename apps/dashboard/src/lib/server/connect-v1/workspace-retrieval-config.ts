/**
 * Resolves the RetrievalConfig (domain pack) for a workspace at request time.
 *
 * This is the payoff of the graphrag-core decoupling: the same MCP/REST surface serves any
 * domain — philosophy, legal, biomedical, custom — by resolving the workspace's selected domain
 * pack and mapping it onto a RetrievalConfig. Falls back to the philosophy preset when no pack
 * is selected or resolution fails.
 */
import { philosophyRetrievalConfig, type RetrievalConfig } from "@restormel/graphrag-core";
import {
  getSelectedDomainPackId,
  getDomainPackForUi,
} from "$lib/server/connect/domain-pack-service";
import { mapDomainPackToRetrievalConfig } from "./domain-pack-retrieval-config.js";

export async function resolveWorkspaceRetrievalConfig(
  workspaceId: string,
): Promise<RetrievalConfig> {
  try {
    const selectedId = await getSelectedDomainPackId(workspaceId);
    if (!selectedId) return philosophyRetrievalConfig;
    const pack = await getDomainPackForUi(workspaceId, selectedId);
    if (!pack) return philosophyRetrievalConfig;
    return mapDomainPackToRetrievalConfig(pack);
  } catch {
    // Never break retrieval on config resolution — degrade to the philosophy default.
    return philosophyRetrievalConfig;
  }
}
