/**
 * Resolves the RetrievalConfig (domain pack) for a workspace at request time.
 *
 * This is the payoff of the graphrag-core decoupling: the same MCP/REST surface can serve
 * any domain — philosophy, legal, biomedical — by resolving a different pack per workspace.
 * Until a domain-pack registry exists, every workspace uses the philosophy pack default.
 */
import { philosophyRetrievalConfig, type RetrievalConfig } from "@restormel/graphrag-core";

export async function resolveWorkspaceRetrievalConfig(
  _workspaceId: string,
): Promise<RetrievalConfig> {
  // TODO: look up the workspace's configured domain pack (philosophy | legal | biomedical | …)
  // and return the matching RetrievalConfig. No registry yet → philosophy default.
  return philosophyRetrievalConfig;
}
