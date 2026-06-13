/**
 * Resolves the RetrievalConfig (domain pack) for a workspace at request time.
 *
 * This is the payoff of the graphrag-core decoupling: the same MCP/REST surface serves any
 * domain — philosophy, legal, biomedical, custom — by resolving the workspace's selected domain
 * pack and mapping it onto a RetrievalConfig.
 *
 * Returns `null` when no domain pack is selected (or resolution fails). Callers must treat
 * `null` as "workspace not configured for retrieval" rather than silently falling back to a
 * philosophy taxonomy — see I12 in docs/reviews/api-audit.md. The orchestrator surfaces this as
 * HTTP 422 `domain_pack_required`.
 */
import { type RetrievalConfig } from "@restormel/graphrag-core";
import {
  getSelectedDomainPackId,
  getDomainPackForUi,
} from "$lib/server/connect/domain-pack-service";
import { mapDomainPackToRetrievalConfig } from "./domain-pack-retrieval-config.js";

export async function resolveWorkspaceRetrievalConfig(
  workspaceId: string,
): Promise<RetrievalConfig | null> {
  try {
    const selectedId = await getSelectedDomainPackId(workspaceId);
    if (!selectedId) return null;
    const pack = await getDomainPackForUi(workspaceId, selectedId);
    if (!pack) return null;
    return mapDomainPackToRetrievalConfig(pack);
  } catch {
    // No silent philosophy fallback — an unresolved pack means the workspace is not configured.
    return null;
  }
}
