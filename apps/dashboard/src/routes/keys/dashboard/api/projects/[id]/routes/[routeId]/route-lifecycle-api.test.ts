import { describe, expect, it, vi } from "vitest";

const mockRoute = {
  id: "route-1",
  projectId: "p1",
  workspaceId: "ws1",
  version: 2,
  publishedVersion: 2,
  name: "Default",
};

const mockSteps = [{ id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true }];
const mockRouteFull = { ...mockRoute, defaultModelId: "gpt-4o", environmentId: "env-1", status: "active" as const };

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getProjectInWorkspace: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getRoute: vi.fn().mockResolvedValue(mockRoute),
  getRouteWithSteps: vi.fn().mockResolvedValue({ route: mockRouteFull, steps: mockSteps }),
  updateRoute: vi.fn().mockResolvedValue({ ...mockRoute, version: 3, publishedVersion: 3 }),
  insertRouteVersionEvent: vi.fn().mockResolvedValue({ id: "evt1" }),
  insertAuditEvent: vi.fn().mockResolvedValue(undefined),
  listRouteVersionEvents: vi.fn().mockResolvedValue([{ id: "evt0", version: 1 }]),
  getRouteVersionEventByVersion: vi.fn().mockResolvedValue({ id: "evt0", version: 1, stepsSnapshot: mockSteps }),
  replaceRouteStepsFromSnapshot: vi.fn().mockResolvedValue(mockSteps),
}));

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    params: { id: "p1", routeId: "route-1" },
    locals: { user: { uid: "u1", authType: "session" } },
    url: new URL("http://localhost/api/projects/p1/routes/route-1/history"),
    request: new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
    ...overrides,
  } as any;
}

describe("Route lifecycle endpoints", () => {
  it("publish returns 200 with publishedVersion", async () => {
    const { POST } = await import("./publish/+server");
    const res = await POST(baseEvent());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.publishedVersion).toBe(3);
  });

  it("publish returns 400 with field errors when steps are not executable", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getRouteWithSteps).mockResolvedValueOnce({
      route: { ...mockRouteFull, defaultModelId: null },
      steps: [
        {
          id: "s1",
          routeId: "route-1",
          orderIndex: 0,
          providerPreference: "openai",
          modelId: null,
          conditionBlock: null,
          fallbackOn: "error",
          timeoutMs: null,
          enabled: true,
          createdAt: new Date(1).toISOString(),
          updatedAt: new Date(1).toISOString(),
        },
      ],
    } as any);
    const { POST } = await import("./publish/+server");
    const res = await POST(baseEvent());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("publish_validation_failed");
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("rollback returns 200 with rolledBackToVersion", async () => {
    const { POST } = await import("./rollback/+server");
    const res = await POST(baseEvent());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.rolledBackToVersion).toBe(1);
  });

  it("history returns entries", async () => {
    const { GET } = await import("./history/+server");
    const res = await GET(baseEvent({ request: undefined }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

