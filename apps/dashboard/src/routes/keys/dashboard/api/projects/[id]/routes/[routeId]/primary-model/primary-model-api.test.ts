import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRoute = { id: "r1" };

vi.mock("$lib/server/db", () => ({
  getRoute: vi.fn().mockResolvedValue(mockRoute),
}));

vi.mock("$lib/server/connect/resolve-stage-route-models", () => ({
  resolvePrimaryStepModel: vi.fn().mockResolvedValue({
    modelId: "gpt-5.2",
    provider: "openai",
    routeId: "r1",
  }),
}));

function mockGetEvent(params: Record<string, string>, locals?: App.Locals) {
  return {
    params,
    locals: locals ?? { user: { uid: "u1" } },
  } as any;
}

describe("GET primary-model", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("./+server");
    const res = await GET(mockGetEvent({ id: "p1", routeId: "r1" }, {} as App.Locals));
    expect(res.status).toBe(401);
  });

  it("returns 403 when gateway key project mismatch", async () => {
    const { GET } = await import("./+server");
    const res = await GET(
      mockGetEvent(
        { id: "p1", routeId: "r1" },
        { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "other", keyId: "k1" } } as App.Locals,
      ),
    );
    expect(res.status).toBe(403);
  });

  it("returns primary model when route exists", async () => {
    const { GET } = await import("./+server");
    const res = await GET(
      mockGetEvent(
        { id: "p1", routeId: "r1" },
        { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } } as App.Locals,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ modelId: "gpt-5.2", provider: "openai", routeId: "r1" });
  });

  it("returns 404 when route missing", async () => {
    const { getRoute } = await import("$lib/server/db");
    vi.mocked(getRoute).mockResolvedValueOnce(null);
    const { GET } = await import("./+server");
    const res = await GET(
      mockGetEvent(
        { id: "p1", routeId: "r1" },
        { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } } as App.Locals,
      ),
    );
    expect(res.status).toBe(404);
  });
});
