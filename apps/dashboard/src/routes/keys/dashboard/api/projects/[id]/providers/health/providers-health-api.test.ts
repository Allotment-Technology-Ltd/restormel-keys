import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getProjectById: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getProjectInWorkspace: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  listProviderBindingsByProject: vi.fn().mockResolvedValue([]),
  listRoutes: vi.fn().mockResolvedValue([]),
  listRouteSteps: vi.fn().mockResolvedValue([]),
  listProviderIntegrations: vi.fn().mockResolvedValue([
    {
      id: "pi-1",
      providerType: "openai",
      displayName: "OpenAI",
      verificationStatus: "verified",
      lastVerifiedAt: 1,
    },
  ]),
}));

function event(locals: App.Locals = { user: { uid: "u1" } } as App.Locals) {
  return {
    params: { id: "p1" },
    locals,
  } as any;
}

describe("GET /api/projects/[id]/providers/health", () => {
  it("returns 401 when missing user", async () => {
    const { GET } = await import("./+server");
    const res = await GET(event({ user: undefined } as App.Locals));
    expect(res.status).toBe(401);
  });

  it("returns workspace integrations when no project bindings exist", async () => {
    const { GET } = await import("./+server");
    const res = await GET(event());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.providers).toHaveLength(1);
    expect(body.data.providers[0]).toMatchObject({
      providerType: "openai",
      verificationStatus: "verified",
      health: "ok",
      confidence: "high",
    });
  });
});

