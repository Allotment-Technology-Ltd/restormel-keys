import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getProjectInWorkspace: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getRouteWithSteps: vi.fn().mockResolvedValue({
    route: { id: "r1" },
    steps: [{ id: "s1", orderIndex: 0, enabled: false }, { id: "s2", orderIndex: 0, enabled: false }],
  }),
}));

describe("POST /api/projects/[id]/routes/[routeId]/recommend", () => {
  it("returns route recommendations", async () => {
    const { POST } = await import("./+server");
    const res = await POST({
      params: { id: "p1", routeId: "r1" },
      locals: { user: { uid: "u1" } },
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.recommendations.length).toBeGreaterThan(0);
    expect(body.data.safeAutoApply).toBe(false);
  });
});
