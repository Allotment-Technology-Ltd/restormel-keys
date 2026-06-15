/**
 * Thin seam onto Phase B's upstream-MCP resolver (REC-PLAN-010).
 *
 * Phase B (`buildWorkspaceUpstreamMcp(workspaceId)` over `upstream_mcp_targets`) is
 * the resolver TARGET for the verifying proxy: given an authorized `workspace_id`,
 * it returns the upstream MCP target that workspace is bound to. Phase B is not
 * necessarily merged on this branch, so Phase C codes against its INTERFACE only
 * and keeps the integration a thin, injectable seam — no behaviour, no coupling.
 *
 * When Phase B lands, its real `buildWorkspaceUpstreamMcp` is injected at the call
 * site (or this module re-exports it). Nothing here reaches the network or a store;
 * tests inject a fixture resolver.
 */

/**
 * The upstream MCP target a workspace is bound to. Mirrors Phase B's
 * `buildWorkspaceUpstreamMcp(workspaceId)` return shape as a structural interface
 * so the two phases stay decoupled until Phase B is merged.
 *
 * Kept intentionally minimal (just the load-bearing fields) — Phase B owns the
 * authoritative shape; this is the contract the resolver depends on.
 */
export type WorkspaceUpstreamMcp = {
  /** The workspace this target is bound to (echoed for isolation assertions). */
  workspaceId: string;
  /** The upstream MCP endpoint URL for this workspace. */
  url: string;
  /**
   * Optional project this workspace's upstream is scoped to. When set, the
   * resolver forwards it to the chokepoint so the management-key project check is
   * satisfied; when absent the resolver authorizes at workspace granularity only.
   * Never used as a default — a `null` here cannot widen scope.
   */
  projectId?: string;
  /** Optional human label for logging/UX; never used for routing decisions. */
  label?: string;
};

/**
 * Phase B's resolver signature. A function `workspaceId -> upstream target | null`.
 * `null` means "no upstream target configured for this workspace" (fail closed:
 * the caller turns that into a 403, never a fallthrough to a default target).
 */
export type BuildWorkspaceUpstreamMcp = (
  workspaceId: string,
) => Promise<WorkspaceUpstreamMcp | null> | WorkspaceUpstreamMcp | null;
