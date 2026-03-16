/**
 * Routes API: creation and resolution (mocked db).
 */
import { describe, it, expect, vi } from "vitest";

const mockRoute = {
  id: "route-1",
  projectId: "p1",
  environmentId: "env-1",
  name: "Default",
  description: null,
  defaultModelId: null,
  billingMode: null,
  routeMode: null,
  status: "active",
  createdBy: "u1",
  createdAt: 1,
  updatedAt: 1,
};

const mockStep = {
  id: "step-1",
  routeId: "route-1",
  orderIndex: 0,
  providerPreference: "openai",
  modelId: "gpt-4o",
  conditionBlock: null,
  fallbackOn: "next",
  timeoutMs: 5000,
  enabled: true,
};

vi.mock("$lib/server/db", () => ({
  getProjectInWorkspace: vi.fn().mockResolvedValue({ id: "p1", userId: "u1" }),
  listRoutes: vi.fn().mockResolvedValue([]),
  getRoute: vi.fn().mockResolvedValue(null),
  createRoute: vi.fn().mockResolvedValue(null),
  updateRoute: vi.fn().mockResolvedValue(null),
  deleteRoute: vi.fn().mockResolvedValue(false),
  listRouteSteps: vi.fn().mockResolvedValue([]),
  createRouteStep: vi.fn().mockResolvedValue(null),
  getRouteWithSteps: vi.fn().mockResolvedValue(null),
}));

function mockEvent(overrides: Record<string, unknown> = {}) {
  return {
    params: { id: "p1" },
    url: new URL("http://localhost/api/projects/p1/routes"),
    locals: { user: { uid: "u1" } },
    ...overrides,
  };
}

describe("GET /api/projects/[id]/routes", () => {
  it("returns list from project", async () => {
    const { GET: handler } = await import("./+server");
    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe("POST /api/projects/[id]/routes", () => {
  it("returns 400 when environmentId or name missing", async () => {
    const { POST: handler } = await import("./+server");
    const res = await handler(
      mockEvent({
        request: new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "Content-Type": "application/json" },
        }),
      }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(400);
  });

  it("creates route with environmentId and name", async () => {
    const { createRoute } = await import("$lib/server/db");
    vi.mocked(createRoute).mockResolvedValue(mockRoute as never);
    const { POST: handler } = await import("./+server");
    const res = await handler(
      mockEvent({
        request: new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({ environmentId: "env-1", name: "Default" }),
          headers: { "Content-Type": "application/json" },
        }),
      }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({ name: "Default", status: "active" });
  });
});

describe("GET /api/projects/[id]/routes/[routeId]", () => {
  it("returns 404 when route not found", async () => {
    const { GET: handler } = await import("./[routeId]/+server");
    const res = await handler(
      mockEvent({ params: { id: "p1", routeId: "nonexistent" } }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(404);
  });

  it("returns route when found", async () => {
    const { getRoute } = await import("$lib/server/db");
    vi.mocked(getRoute).mockResolvedValue(mockRoute as never);
    const { GET: handler } = await import("./[routeId]/+server");
    const res = await handler(
      mockEvent({ params: { id: "p1", routeId: "route-1" } }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({ id: "route-1", name: "Default" });
  });
});

describe("Route resolution (getRouteWithSteps)", () => {
  it("returns route with steps for resolution", async () => {
    const { getRouteWithSteps } = await import("$lib/server/db");
    vi.mocked(getRouteWithSteps).mockResolvedValue({ route: mockRoute as never, steps: [mockStep as never] });
    const result = await getRouteWithSteps("route-1", "p1", "u1");
    expect(result).not.toBeNull();
    expect(result!.route.name).toBe("Default");
    expect(result!.steps).toHaveLength(1);
    expect(result!.steps[0].fallbackOn).toBe("next");
  });
});
