/**
 * Thin seam onto Phase B's upstream-MCP resolver (REC-PLAN-010).
 *
 * Phase B (`buildWorkspaceUpstreamMcp(workspaceId)` over `upstream_mcp_targets`) is
 * the resolver TARGET for the verifying proxy: given an authorized `workspace_id`,
 * it returns the upstream MCP target that workspace is bound to.
 *
 * Phase B is now merged. This module wires Phase B's real `buildWorkspaceUpstreamMcp`
 * into the seam via `buildWorkspaceUpstreamMcpSeam`, adapting its `ResolveResult`
 * return shape to the `WorkspaceUpstreamMcp | null` shape Phase C expects:
 *
 *   ResolveResult { ok: true; descriptor } → WorkspaceUpstreamMcp (endpoint → url)
 *   ResolveResult { ok: false }            → null   (fail closed; caller → 403)
 *
 * The adapter is the ONLY translation point; no logic is duplicated. Tests inject a
 * fixture resolver (the `BuildWorkspaceUpstreamMcp` function type) directly, so the
 * adapter is covered by `upstream-mcp-seam.test.ts` and the wired path is covered by
 * `tenant-isolation.test.ts` and `resolve-workspace.test.ts`.
 *
 * Nothing here reaches the network or a store; tests inject a fixture resolver.
 */
import { buildWorkspaceUpstreamMcp as _buildWorkspaceUpstreamMcp } from "$lib/server/connect/upstream-mcp-service.js";

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

/**
 * Adapter: wraps Phase B's `buildWorkspaceUpstreamMcp` (which returns a
 * `ResolveResult` discriminated union) into the `BuildWorkspaceUpstreamMcp`
 * signature Phase C's `resolveWorkspaceFromToken` depends on.
 *
 * Mapping:
 *   descriptor.endpoint  → WorkspaceUpstreamMcp.url
 *   descriptor.workspaceId → WorkspaceUpstreamMcp.workspaceId
 *   descriptor.label (from DB label field, omitted from UpstreamMcpDescriptor)
 *       → WorkspaceUpstreamMcp.label (absent; label is UI-only, not load-bearing)
 *
 * `projectId` is absent from `UpstreamMcpDescriptor` by design — upstream MCP
 * targets are workspace-scoped, not project-scoped; the chokepoint authorizes at
 * workspace granularity when `projectId` is omitted. A `null` here cannot widen
 * scope; this is the safe default.
 *
 * `ok: false` → `null` (fail closed). Phase C turns `null` into a 403
 * `workspace_scope_mismatch` response — it never falls through to a default target.
 *
 * This function satisfies the `BuildWorkspaceUpstreamMcp` type and is the value
 * Phase C call sites should inject when they run under the real stack. Tests may
 * inject a fixture resolver directly.
 */
export async function buildWorkspaceUpstreamMcpSeam(
  workspaceId: string,
): Promise<WorkspaceUpstreamMcp | null> {
  const result = await _buildWorkspaceUpstreamMcp(workspaceId);
  if (!result.ok) {
    // Any failure (not_found, invalid_endpoint, flag off) → null → 403 at Phase C.
    // Never fall through to a default target.
    return null;
  }
  return {
    workspaceId: result.descriptor.workspaceId,
    url: result.descriptor.endpoint,
    // projectId is not carried in UpstreamMcpDescriptor — workspace-granularity auth.
    // label is UI-only and not load-bearing; omit from the routing descriptor.
  };
}
