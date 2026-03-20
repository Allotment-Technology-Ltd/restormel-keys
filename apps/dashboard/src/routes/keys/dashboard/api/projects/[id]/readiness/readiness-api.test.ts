import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getProjectInWorkspace: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  listProviderBindingsByProject: vi.fn().mockResolvedValue([]),
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
});
