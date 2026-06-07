/**
 * Graph v1 REST route wiring tests.
 */
import { describe, it, expect } from "vitest";

const layoutBody = JSON.stringify({
  snapshot: {
    nodes: [
      { id: "a", type: "source", label: "A" },
      { id: "b", type: "claim", label: "B" },
    ],
    edges: [{ from: "a", to: "b", type: "contains" }],
  },
  width: 800,
  height: 600,
});

describe("POST /graph/v1/layout", () => {
  it("returns layout JSON for valid snapshot when authenticated", async () => {
    const { POST } = await import("./layout/+server");
    const res = await POST({
      request: new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: layoutBody,
      }),
      // I4: layout now requires auth (gateway key / management key / session).
      locals: { user: { uid: "u1", authType: "session" } },
    } as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.layout.positions.a).toBeDefined();
    expect(data.layout.positions.b).toBeDefined();
  });

  it("rejects unauthenticated requests with 401 (I4)", async () => {
    const { POST } = await import("./layout/+server");
    const res = await POST({
      request: new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: layoutBody,
      }),
      locals: {},
    } as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(401);
  });
});

describe("GET /graph/v1/snapshots/{snapshotId}", () => {
  it("returns 404 until hosted persistence (Phase 6)", async () => {
    const { GET } = await import("./snapshots/[snapshotId]/+server");
    const res = await GET({
      params: { snapshotId: "demo-snapshot-1" },
    } as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(404);
  });
});
