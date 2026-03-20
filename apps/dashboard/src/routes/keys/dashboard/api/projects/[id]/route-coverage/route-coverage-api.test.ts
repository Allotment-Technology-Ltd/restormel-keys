import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getProjectInWorkspace: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  listRoutes: vi.fn().mockResolvedValue([
    { id: "r1", environmentId: "env1", workload: "ingestion", stage: "normalize", enabled: true },
    { id: "r2", environmentId: "env1", workload: "ingestion", stage: "extract", enabled: true },
  ]),
  listRouteSteps: vi
    .fn()
    .mockResolvedValueOnce([{ id: "s1", enabled: true }])
    .mockResolvedValueOnce([{ id: "s2", enabled: false }]),
}));

function event(locals: App.Locals = { user: { uid: "u1" } } as App.Locals) {
  return {
    params: { id: "p1" },
    locals,
  } as any;
}

describe("GET /api/projects/[id]/route-coverage", () => {
  it("returns 401 when missing user", async () => {
    const { GET } = await import("./+server");
    const res = await GET(event({ user: undefined } as App.Locals));
    expect(res.status).toBe(401);
  });

  it("returns route coverage summary", async () => {
    const { GET } = await import("./+server");
    const res = await GET(event());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.routeCount).toBe(2);
    expect(body.data.zeroEnabledStepRoutes).toBe(1);
    expect(body.data.environments[0].environmentId).toBe("env1");
  });
});
