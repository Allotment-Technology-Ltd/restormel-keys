import { afterEach, describe, expect, it, vi } from "vitest";

describe("POST /api/cli/device/authorize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns 401 when session is missing", async () => {
    const { POST } = await import("./+server");
    const res = await POST({
      locals: { user: undefined },
      request: new Request("http://localhost/keys/dashboard/api/cli/device/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userCode: "ABCD-EFGH", projectId: "p1" }),
      }),
    } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });

  it("returns 403 for gateway_key auth", async () => {
    const { POST } = await import("./+server");
    const res = await POST({
      locals: {
        user: { uid: "u1", authType: "gateway_key" as const, projectIdForKey: "p1", keyId: "k1" },
      },
      request: new Request("http://localhost/keys/dashboard/api/cli/device/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userCode: "ABCD-EFGH", projectId: "p1" }),
      }),
    } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(403);
  });
});
