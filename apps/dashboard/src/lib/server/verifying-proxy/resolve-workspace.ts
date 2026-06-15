/**
 * C2 — token → workspace_id resolver (REC-PLAN-011, Phase C).
 *
 * THE single place that maps a validated token's claims to a `workspace_id`, then
 * hands off to the existing `authorizeKnowledgeWorkspaceRequest` chokepoint. A
 * wrong mapping is an expensive re-key (R4), so the mapping lives here, in ONE
 * place, well-tested, and fails closed:
 *
 *   - no usable `workspace_id` claim          → 401 (cannot establish identity)
 *   - claim maps to an unknown/unbound space  → 403 workspace_scope_mismatch
 *   - claim resolves to A but request targets B → 403 workspace_scope_mismatch
 *
 * This path is an ALTERNATIVE ingress identity (OAuth resource server) — it does
 * NOT replace the dashboard better-auth session. It synthesizes an
 * `authType: "management_key"`-shaped principal (workspace-scoped, no project)
 * for the chokepoint, which already enforces `workspace_id` equality and emits
 * `workspace_scope_mismatch` on cross-tenant attempts.
 */

import {
  authorizeKnowledgeWorkspaceRequest,
  type ConnectV1AuthScope,
  type ConnectV1AuthFailure,
} from "$lib/server/connect-v1/auth.js";
import type { VerifiedTokenClaims } from "./verify-access-token.js";
import type {
  BuildWorkspaceUpstreamMcp,
  WorkspaceUpstreamMcp,
} from "./upstream-mcp-seam.js";

/** Claim name carrying the workspace binding. Kept here so the mapping is one place. */
const WORKSPACE_CLAIM = "workspace_id";

export type ResolveWorkspaceSuccess = {
  ok: true;
  /** The authorized scope from the chokepoint. */
  scope: ConnectV1AuthScope;
  /** The Phase B upstream target this workspace is bound to. */
  upstream: WorkspaceUpstreamMcp;
};

export type ResolveWorkspaceFailure = {
  ok: false;
  status: 401 | 403;
  error: string;
  message: string;
};

export type ResolveWorkspaceResult = ResolveWorkspaceSuccess | ResolveWorkspaceFailure;

export type ResolveWorkspaceDeps = {
  /**
   * Phase B's resolver (`buildWorkspaceUpstreamMcp`). Injected to keep the
   * integration a thin seam until Phase B is merged.
   */
  buildWorkspaceUpstreamMcp: BuildWorkspaceUpstreamMcp;
  /**
   * The chokepoint. Defaults to the real `authorizeKnowledgeWorkspaceRequest`;
   * overridable in tests so isolation can be asserted without a DB.
   */
  authorize?: (args: {
    locals: App.Locals;
    workspaceId: string;
    projectId?: string;
  }) => Promise<ConnectV1AuthScope | ConnectV1AuthFailure>;
};

/**
 * Extract the workspace id from validated claims. THE mapping. Currently a direct
 * `workspace_id` claim; a subject→workspace lookup table would slot in here and
 * nowhere else. Returns `null` when no usable claim is present (→ fail closed 401).
 */
export function mapClaimsToWorkspaceId(claims: VerifiedTokenClaims): string | null {
  const direct = claims.raw[WORKSPACE_CLAIM];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  return null;
}

/**
 * Resolve validated token claims to an authorized workspace + its upstream target.
 *
 * `requestedWorkspaceId` is the workspace the *request* is asking to act on (e.g.
 * from the request body/route). The token-derived workspace must equal it; the
 * chokepoint enforces this and emits `workspace_scope_mismatch` (403) otherwise —
 * that is how tenant A's token is provably barred from tenant B's target.
 */
export async function resolveWorkspaceFromToken(
  claims: VerifiedTokenClaims,
  requestedWorkspaceId: string,
  deps: ResolveWorkspaceDeps,
): Promise<ResolveWorkspaceResult> {
  // 1. Map claims → workspace_id (THE mapping). No claim ⇒ fail closed 401.
  const tokenWorkspaceId = mapClaimsToWorkspaceId(claims);
  if (!tokenWorkspaceId) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "Access token carries no workspace claim",
    };
  }

  // 2. Resolve the upstream target for the TOKEN's workspace via Phase B. Unknown /
  //    unbound workspace ⇒ 403 (never a fallthrough to a default target). Doing this
  //    before the chokepoint also yields the optional project binding to forward.
  const upstream = await deps.buildWorkspaceUpstreamMcp(tokenWorkspaceId);
  if (!upstream) {
    return {
      ok: false,
      status: 403,
      error: "workspace_scope_mismatch",
      message: "No upstream target bound to this workspace",
    };
  }
  if (upstream.workspaceId !== tokenWorkspaceId) {
    // Defence in depth: a misconfigured Phase B target for a different workspace.
    return {
      ok: false,
      status: 403,
      error: "workspace_scope_mismatch",
      message: "Upstream target workspace does not match the token workspace",
    };
  }

  // 3. Synthesize a workspace-scoped principal from the TOKEN's workspace, then ask
  //    the chokepoint to authorize the REQUESTED workspace. The chokepoint's
  //    `workspace_id` equality check is the isolation boundary: a token bound to A
  //    authorizing a request for B ⇒ 403 workspace_scope_mismatch. The upstream's
  //    optional project binding is forwarded so the management-key project check is
  //    satisfied when present (and never widened when absent).
  const locals = {
    user: {
      uid: claims.subject,
      authType: "management_key" as const,
      workspaceId: tokenWorkspaceId,
    },
  } as App.Locals;

  const authorize = deps.authorize ?? authorizeKnowledgeWorkspaceRequest;
  const auth = await authorize({
    locals,
    workspaceId: requestedWorkspaceId,
    projectId: upstream.projectId,
  });

  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, error: auth.error, message: auth.message };
  }

  return { ok: true, scope: auth, upstream };
}
