/**
 * C3 — multi-tenant isolation proof (REC-PLAN-011, the headline test).
 *
 * Two tenants (A, B), two signed tokens, two upstream MCP targets. This suite
 * wires the END-TO-END OAuth ingress path:
 *
 *     bearer token --verifyAccessToken--> claims --resolveWorkspaceFromToken-->
 *         authorizeKnowledgeWorkspaceRequest (the REAL chokepoint) --> upstream
 *
 * It uses the real `authorizeKnowledgeWorkspaceRequest` so the isolation boundary
 * being asserted is the production one — only `$lib/server/db` is mocked (no DB),
 * mirroring the existing chokepoint handler tests. Hermetic: tokens are
 * signed/verified in-process, NO network.
 *
 * Asserts:
 *   - A's token resolves ONLY A's workspace/target;
 *   - A's token against B's target → 403 workspace_scope_mismatch (and B vs A);
 *   - missing / expired / wrong-aud token → 401;
 *   - token with no workspace claim → 401.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the data layer the real chokepoint reads (management-key project lookup).
vi.mock("$lib/server/db", () => ({
  getProject: vi.fn(),
  getProjectInWorkspace: vi.fn(),
}));

import { getProjectInWorkspace } from "$lib/server/db";
import { verifyAccessToken, type VerifyAccessTokenDeps } from "./verify-access-token.js";
import { resolveWorkspaceFromToken } from "./resolve-workspace.js";
import type { WorkspaceUpstreamMcp } from "./upstream-mcp-seam.js";
import {
  makeKeys,
  mintToken,
  makeJwksVerifier,
  type TokenKeys,
} from "./test-fixtures.js";

const AUDIENCE = "proxy-resource";
const ISSUER = "https://hydra.example";

// Two tenants. UUIDs to match the chokepoint's real-world id shape.
const WS_A = "11111111-1111-4111-8111-111111111111";
const WS_B = "22222222-2222-4222-8222-222222222222";
const PROJ_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJ_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const UPSTREAM_A: WorkspaceUpstreamMcp = {
  workspaceId: WS_A,
  url: "https://mcp.tenant-a.example",
  projectId: PROJ_A,
};
const UPSTREAM_B: WorkspaceUpstreamMcp = {
  workspaceId: WS_B,
  url: "https://mcp.tenant-b.example",
  projectId: PROJ_B,
};

/** Phase B seam fixture: workspace → upstream target. */
function buildUpstream(workspaceId: string): WorkspaceUpstreamMcp | null {
  if (workspaceId === WS_A) return UPSTREAM_A;
  if (workspaceId === WS_B) return UPSTREAM_B;
  return null;
}

let keys: TokenKeys;

beforeAll(async () => {
  keys = await makeKeys();
});

function verifierDeps(): VerifyAccessTokenDeps {
  return {
    config: { audience: AUDIENCE, issuer: ISSUER, requiredScope: "connect.proxy" },
    jwksVerifier: makeJwksVerifier(keys, { audience: AUDIENCE, issuer: ISSUER }),
  };
}

/** Drive the full ingress: token string → resolved workspace/upstream (or failure). */
async function ingress(token: string, requestedWorkspaceId: string) {
  const verified = await verifyAccessToken(token, verifierDeps());
  if (!verified.ok) {
    return { stage: "verify" as const, status: verified.status, error: verified.error };
  }
  const resolved = await resolveWorkspaceFromToken(verified.claims, requestedWorkspaceId, {
    buildWorkspaceUpstreamMcp: buildUpstream,
    // real authorizeKnowledgeWorkspaceRequest (default) — DB is mocked above.
  });
  if (!resolved.ok) {
    return { stage: "resolve" as const, status: resolved.status, error: resolved.error };
  }
  return {
    stage: "ok" as const,
    workspaceId: resolved.scope.workspaceId,
    upstreamUrl: resolved.upstream.url,
  };
}

describe("C3 multi-tenant isolation (end-to-end, real chokepoint)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The real chokepoint, management-key path, looks up the project IN the
    // claimed workspace. Return a project only when it genuinely belongs there —
    // so a cross-tenant project id can never resolve.
    vi.mocked(getProjectInWorkspace).mockImplementation(
      async (projectId: string, workspaceId: string) => {
        if (projectId === PROJ_A && workspaceId === WS_A) {
          return { id: PROJ_A, userId: "user-a", workspaceId: WS_A } as never;
        }
        if (projectId === PROJ_B && workspaceId === WS_B) {
          return { id: PROJ_B, userId: "user-b", workspaceId: WS_B } as never;
        }
        return null;
      },
    );
  });

  async function tokenFor(workspaceId: string, subject: string) {
    return mintToken(keys, {
      subject,
      audience: AUDIENCE,
      issuer: ISSUER,
      workspaceId,
      scope: "connect.proxy",
    });
  }

  it("A's token resolves ONLY A's workspace + upstream", async () => {
    const tokenA = await tokenFor(WS_A, "user-a");
    const res = await ingress(tokenA, WS_A);
    expect(res.stage).toBe("ok");
    if (res.stage !== "ok") return;
    expect(res.workspaceId).toBe(WS_A);
    expect(res.upstreamUrl).toBe(UPSTREAM_A.url);
  });

  it("B's token resolves ONLY B's workspace + upstream", async () => {
    const tokenB = await tokenFor(WS_B, "user-b");
    const res = await ingress(tokenB, WS_B);
    expect(res.stage).toBe("ok");
    if (res.stage !== "ok") return;
    expect(res.workspaceId).toBe(WS_B);
    expect(res.upstreamUrl).toBe(UPSTREAM_B.url);
  });

  it("A's token against B's target → 403 workspace_scope_mismatch (the core proof)", async () => {
    const tokenA = await tokenFor(WS_A, "user-a");
    const res = await ingress(tokenA, WS_B);
    expect(res.stage).toBe("resolve");
    if (res.stage !== "resolve") return;
    expect(res.status).toBe(403);
    expect(res.error).toBe("workspace_scope_mismatch");
  });

  it("B's token against A's target → 403 workspace_scope_mismatch (symmetric)", async () => {
    const tokenB = await tokenFor(WS_B, "user-b");
    const res = await ingress(tokenB, WS_A);
    expect(res.stage).toBe("resolve");
    if (res.stage !== "resolve") return;
    expect(res.status).toBe(403);
    expect(res.error).toBe("workspace_scope_mismatch");
  });

  it("missing token → 401", async () => {
    const res = await ingress("", WS_A);
    expect(res.stage).toBe("verify");
    if (res.stage !== "verify") return;
    expect(res.status).toBe(401);
  });

  it("expired token → 401", async () => {
    const expired = await mintToken(keys, {
      subject: "user-a",
      audience: AUDIENCE,
      issuer: ISSUER,
      workspaceId: WS_A,
      scope: "connect.proxy",
      expiresInSeconds: -30,
    });
    const res = await ingress(expired, WS_A);
    expect(res.stage).toBe("verify");
    if (res.stage !== "verify") return;
    expect(res.status).toBe(401);
  });

  it("wrong-audience token → 401", async () => {
    const wrongAud = await mintToken(keys, {
      subject: "user-a",
      audience: "some-other-resource",
      issuer: ISSUER,
      workspaceId: WS_A,
      scope: "connect.proxy",
    });
    const res = await ingress(wrongAud, WS_A);
    expect(res.stage).toBe("verify");
    if (res.stage !== "verify") return;
    expect(res.status).toBe(401);
  });

  it("token with NO workspace claim → 401 (fail closed before the chokepoint)", async () => {
    const noWs = await mintToken(keys, {
      subject: "user-a",
      audience: AUDIENCE,
      issuer: ISSUER,
      workspaceId: null, // omit the claim
      scope: "connect.proxy",
    });
    const res = await ingress(noWs, WS_A);
    expect(res.stage).toBe("resolve");
    if (res.stage !== "resolve") return;
    expect(res.status).toBe(401);
    // The chokepoint was never consulted — identity could not be established.
    expect(getProjectInWorkspace).not.toHaveBeenCalled();
  });

  it("A's token cannot borrow B's project even if it claims A's workspace", async () => {
    // A's token, A's workspace — but Phase B (mocked) hands back a target whose
    // project belongs to B. The chokepoint's project-in-workspace lookup fails,
    // so no cross-tenant project leaks.
    const tokenA = await tokenFor(WS_A, "user-a");
    const resolved = await resolveWorkspaceFromToken(
      { subject: "user-a", audience: [AUDIENCE], scopes: ["connect.proxy"], raw: { workspace_id: WS_A } },
      WS_A,
      {
        buildWorkspaceUpstreamMcp: () => ({ workspaceId: WS_A, url: UPSTREAM_A.url, projectId: PROJ_B }),
      },
    );
    // verify the token is valid in isolation (sanity), then assert the cross-project
    // resolve is rejected by the real chokepoint.
    const verified = await verifyAccessToken(tokenA, verifierDeps());
    expect(verified.ok).toBe(true);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.status).toBe(403);
  });
});
