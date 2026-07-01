import { describe, expect, it, vi } from "vitest";
import { listProviderIntegrations } from "$lib/server/db";

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getProjectInWorkspace: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  listProviderBindingsByProject: vi.fn().mockResolvedValue([]),
  listProviderIntegrations: vi.fn().mockResolvedValue([]),
  listRoutes: vi.fn().mockResolvedValue([{ id: "r1" }]),
  listRouteSteps: vi.fn().mockResolvedValue([{ id: "s1", enabled: false }]),
  listPolicies: vi.fn().mockResolvedValue([]),
  listPolicyBindings: vi.fn().mockResolvedValue([]),
}));

function event(locals: App.Locals = { user: { uid: "u1" } } as App.Locals) {
  return {
    params: { id: "p1" },
    locals,
  } as any;
}

describe("GET /api/projects/[id]/readiness", () => {
  it("returns fail when core controls are missing", async () => {
    const { GET } = await import("./+server");
    const res = await GET(event());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("fail");
    expect(body.data.issues.length).toBeGreaterThan(0);
    expect(body.data.recommendations.length).toBeGreaterThan(0);
  });

  // RES-154: no explicit project binding is no longer a blocking issue on its own —
  // routes fall back to any usable workspace key (runtime-invoke.ts), so readiness
  // should not flag it when the workspace has one.
  it("does not flag no_provider_bindings when the workspace has a usable key, even with zero explicit bindings", async () => {
    vi.mocked(listProviderIntegrations).mockResolvedValueOnce([
      {
        id: "int1",
        workspaceId: "ws1",
        providerType: "openai",
        displayName: "OpenAI",
        status: "active",
        verificationStatus: "verified",
        credentialRef: null,
        createdBy: "u1",
        createdAt: 1,
        lastVerifiedAt: 1,
        metadata: null,
        region: null,
        hasEncryptedCredential: true,
      } as never,
    ]);
    const { GET } = await import("./+server");
    const res = await GET(event());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.issues.some((i: { code: string }) => i.code === "no_provider_bindings")).toBe(false);
  });
});
