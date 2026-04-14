/**
 * Steps API tests (mocked db).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ModelRecord } from "$lib/server/neon";

const mockRoute = { id: "r1" };

vi.mock("$lib/server/db", () => ({
  getRoute: vi.fn().mockResolvedValue(mockRoute),
  listRouteSteps: vi.fn().mockResolvedValue([]),
  createRouteStep: vi.fn().mockResolvedValue({
    id: "s1",
    routeId: "r1",
    orderIndex: 0,
    providerPreference: "anthropic",
    modelId: "claude-sonnet-4",
    conditionBlock: null,
    fallbackOn: "error",
    timeoutMs: null,
    enabled: true,
    createdAt: new Date(1).toISOString(),
    updatedAt: new Date(1).toISOString(),
  }),
  updateRouteStep: vi.fn().mockResolvedValue({
    id: "s1",
    routeId: "r1",
    orderIndex: 1,
    providerPreference: "anthropic",
    modelId: "claude-sonnet-4",
    conditionBlock: null,
    fallbackOn: "error",
    timeoutMs: null,
    enabled: false,
    createdAt: new Date(1).toISOString(),
    updatedAt: new Date(2).toISOString(),
  }),
  deleteRouteStep: vi.fn().mockResolvedValue(true),
  getModel: vi.fn().mockResolvedValue({ id: "claude-sonnet-4" }),
}));

function mockEvent(params: Record<string, string>, body?: unknown, locals?: App.Locals) {
  return {
    params,
    locals: locals ?? { user: { uid: "u1" } },
    request: new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  } as any;
}

describe("Steps API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POST creates a step (201)", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent(
        { id: "p1", routeId: "r1" },
        { orderIndex: 0, providerPreference: "anthropic", modelId: "claude-sonnet-4", fallbackOn: "error", enabled: true },
        { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } }
      )
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty("id");
    expect(body.data.orderIndex).toBe(0);
  });

  it("GET returns steps ordered by orderIndex", async () => {
    const { listRouteSteps } = await import("$lib/server/db");
    vi.mocked(listRouteSteps).mockResolvedValue([
      { id: "s2", routeId: "r1", orderIndex: 1, providerPreference: "openai", modelId: null, conditionBlock: null, fallbackOn: "error", timeoutMs: null, enabled: true, createdAt: new Date(1).toISOString(), updatedAt: new Date(1).toISOString() },
      { id: "s1", routeId: "r1", orderIndex: 0, providerPreference: "anthropic", modelId: null, conditionBlock: null, fallbackOn: "error", timeoutMs: null, enabled: true, createdAt: new Date(1).toISOString(), updatedAt: new Date(1).toISOString() },
    ]);
    const { GET } = await import("./+server");
    const res = await GET(
      {
        params: { id: "p1", routeId: "r1" },
        locals: { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } },
      } as unknown as Parameters<typeof GET>[0]
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });

  it("POST with cross-project Gateway Key returns 403", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent(
        { id: "p2", routeId: "r1" },
        { orderIndex: 0, providerPreference: "anthropic" },
        { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } }
      )
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("POST accepts voyage with a catalog model id", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getModel).mockResolvedValueOnce({ id: "voyage-3" } as ModelRecord);
    vi.mocked(db.createRouteStep).mockResolvedValueOnce({
      id: "sv1",
      routeId: "r1",
      orderIndex: 2,
      providerPreference: "voyage",
      modelId: "voyage-3",
      conditionBlock: null,
      fallbackOn: "error",
      timeoutMs: null,
      enabled: true,
      createdAt: new Date(1).toISOString(),
      updatedAt: new Date(1).toISOString(),
    });
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent(
        { id: "p1", routeId: "r1" },
        { orderIndex: 2, providerPreference: "voyage", modelId: "voyage-3", fallbackOn: "error", enabled: true },
        { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } }
      )
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.providerPreference).toBe("voyage");
    expect(body.data.modelId).toBe("voyage-3");
  });

  it("POST invalid providerPreference returns 400", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent(
        { id: "p1", routeId: "r1" },
        { orderIndex: 0, providerPreference: "not-a-provider" },
        { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } }
      )
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("route_step_provider_not_allowed");
    expect(Array.isArray(body.allowed)).toBe(true);
    expect(body.allowed).toContain("openai");
  });

  it("POST duplicate orderIndex returns 409", async () => {
    const { listRouteSteps } = await import("$lib/server/db");
    vi.mocked(listRouteSteps).mockResolvedValue([
      { id: "s1", routeId: "r1", orderIndex: 0, providerPreference: "anthropic", modelId: null, conditionBlock: null, fallbackOn: "error", timeoutMs: null, enabled: true, createdAt: new Date(1).toISOString(), updatedAt: new Date(1).toISOString() },
    ]);
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent(
        { id: "p1", routeId: "r1" },
        { orderIndex: 0, providerPreference: "anthropic" },
        { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } }
      )
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("duplicate_order_index");
  });
});

