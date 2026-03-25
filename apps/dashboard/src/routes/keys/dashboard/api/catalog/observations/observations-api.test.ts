import { describe, it, expect, vi } from "vitest";

vi.mock("$lib/server/db", () => ({
  upsertCatalogModelObservation: vi.fn().mockResolvedValue(undefined),
  getProjectById: vi.fn().mockResolvedValue({ id: "p1", workspaceId: "ws1" }),
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue({ id: "ws2" }),
}));

function event(overrides: { locals?: App.Locals; request?: Request } = {}) {
  return {
    params: {},
    request:
      overrides.request ??
      new Request("http://localhost/api/catalog/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: "openai",
          providerModelId: "gpt-4o",
          signal: "deprecated",
        }),
      }),
    locals: overrides.locals ?? ({ user: { uid: "u1" } } as App.Locals),
  } as Parameters<(typeof import("./+server"))["POST"]>[0];
}

describe("POST /api/catalog/observations", () => {
  it("returns 401 without user", async () => {
    const { POST } = await import("./+server");
    const res = await POST(event({ locals: { user: undefined } as App.Locals }));
    expect(res.status).toBe(401);
  });

  it("upserts when gateway key resolves workspace", async () => {
    const { upsertCatalogModelObservation } = await import("$lib/server/db");
    const { POST } = await import("./+server");
    const res = await POST(
      event({
        locals: {
          user: { authType: "gateway_key", uid: "u1", projectIdForKey: "p1", keyId: "k1" },
        } as App.Locals,
      }) as never
    );
    expect(res.status).toBe(200);
    expect(upsertCatalogModelObservation).toHaveBeenCalled();
  });
});
