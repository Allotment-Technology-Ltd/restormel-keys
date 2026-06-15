/**
 * C2 tests — token → workspace_id resolver (REC-PLAN-011).
 *
 * Asserts the mapping is fail-closed: no claim → 401; unknown/unbound workspace →
 * 403; and the chokepoint's `workspace_scope_mismatch` is propagated for a token
 * whose workspace does not match the requested target. The chokepoint is injected
 * here so the mapping logic is tested without a DB; the C3 isolation suite wires
 * the REAL `authorizeKnowledgeWorkspaceRequest`.
 */
import { describe, expect, it, vi } from "vitest";

// The resolver imports the real chokepoint, which pulls in the data layer. The
// chokepoint is INJECTED in these tests (never the real one), so the DB is mocked
// purely to keep the import graph hermetic — mirrors the existing handler tests.
vi.mock("$lib/server/db", () => ({
  getProject: vi.fn(),
  getProjectInWorkspace: vi.fn(),
}));

import {
  resolveWorkspaceFromToken,
  mapClaimsToWorkspaceId,
  type ResolveWorkspaceDeps,
} from "./resolve-workspace.js";
import type { VerifiedTokenClaims } from "./verify-access-token.js";
import type { WorkspaceUpstreamMcp } from "./upstream-mcp-seam.js";

function claims(workspaceId: string | undefined, subject = "sub-1"): VerifiedTokenClaims {
  const raw: Record<string, unknown> = {};
  if (workspaceId !== undefined) raw.workspace_id = workspaceId;
  return {
    subject,
    audience: ["proxy-resource"],
    scopes: ["connect.proxy"],
    raw,
  };
}

/** Phase B seam fixture: a fixed table of workspace → upstream target. */
function upstreamTable(table: Record<string, WorkspaceUpstreamMcp>) {
  return (workspaceId: string) => table[workspaceId] ?? null;
}

/** A chokepoint stub that authorizes when the token workspace === requested workspace. */
function authorizeStub() {
  return vi.fn(
    async (args: { locals: App.Locals; workspaceId: string; projectId?: string }) => {
      const tokenWs = args.locals.user?.workspaceId;
      if (!tokenWs) {
        return { status: 401 as const, error: "unauthorized", message: "no workspace" };
      }
      if (tokenWs !== args.workspaceId) {
        return {
          status: 403 as const,
          error: "workspace_scope_mismatch",
          message: "workspace_id does not match the management key",
        };
      }
      return {
        userId: args.locals.user?.uid ?? "",
        projectId: "",
        workspaceId: tokenWs,
        authType: "management_key" as const,
      };
    },
  );
}

describe("mapClaimsToWorkspaceId", () => {
  it("reads a direct workspace_id claim", () => {
    expect(mapClaimsToWorkspaceId(claims("ws-a"))).toBe("ws-a");
  });
  it("trims surrounding whitespace", () => {
    expect(mapClaimsToWorkspaceId(claims("  ws-a  "))).toBe("ws-a");
  });
  it("returns null when the claim is absent (fail closed)", () => {
    expect(mapClaimsToWorkspaceId(claims(undefined))).toBeNull();
  });
  it("returns null when the claim is empty/blank (fail closed)", () => {
    expect(mapClaimsToWorkspaceId(claims("   "))).toBeNull();
  });
});

describe("resolveWorkspaceFromToken", () => {
  const upstream: WorkspaceUpstreamMcp = { workspaceId: "ws-a", url: "https://mcp.a.example" };

  function deps(authorize = authorizeStub()): ResolveWorkspaceDeps & {
    authorize: ReturnType<typeof authorizeStub>;
  } {
    return {
      authorize,
      buildWorkspaceUpstreamMcp: upstreamTable({ "ws-a": upstream }),
    };
  }

  it("resolves a token to its own workspace + upstream", async () => {
    const res = await resolveWorkspaceFromToken(claims("ws-a"), "ws-a", deps());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.scope.workspaceId).toBe("ws-a");
    expect(res.upstream.url).toBe("https://mcp.a.example");
  });

  it("fails closed with 401 when the token has no workspace claim", async () => {
    const d = deps();
    const res = await resolveWorkspaceFromToken(claims(undefined), "ws-a", d);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(401);
    // Never reached the chokepoint — identity could not be established.
    expect(d.authorize).not.toHaveBeenCalled();
  });

  it("returns 403 workspace_scope_mismatch when the token targets another workspace", async () => {
    const res = await resolveWorkspaceFromToken(claims("ws-a"), "ws-b", deps());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(403);
    expect(res.error).toBe("workspace_scope_mismatch");
  });

  it("returns 403 when the authorized workspace has no upstream target (unknown/unbound)", async () => {
    // Token + request agree on ws-z, but Phase B has no target bound to it.
    const d: ResolveWorkspaceDeps = {
      authorize: authorizeStub(),
      buildWorkspaceUpstreamMcp: upstreamTable({ "ws-a": upstream }),
    };
    const res = await resolveWorkspaceFromToken(claims("ws-z"), "ws-z", d);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(403);
    expect(res.error).toBe("workspace_scope_mismatch");
  });

  it("returns 403 when the upstream target's workspace mismatches the scope (defence in depth)", async () => {
    const d: ResolveWorkspaceDeps = {
      authorize: authorizeStub(),
      // Misconfigured Phase B: target for ws-a claims to belong to ws-b.
      buildWorkspaceUpstreamMcp: upstreamTable({
        "ws-a": { workspaceId: "ws-b", url: "https://mcp.b.example" },
      }),
    };
    const res = await resolveWorkspaceFromToken(claims("ws-a"), "ws-a", d);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(403);
    expect(res.error).toBe("workspace_scope_mismatch");
  });
});
