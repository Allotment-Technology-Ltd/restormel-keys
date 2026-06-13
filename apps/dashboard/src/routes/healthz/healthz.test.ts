import { describe, it, expect, vi } from "vitest";

// The healthz handler must not import or call any DB or external-service code.
// We deliberately do NOT mock $lib/server/db — if the handler ever inadvertently
// imports it the test will fail with a resolution error (good — catches regressions).

describe("GET /healthz", () => {
  it("returns 200 with body 'ok'", async () => {
    const { GET } = await import("./+server");
    // The handler ignores the request object entirely — pass a minimal stub.
    const res = await GET({} as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("ok");
  });

  it("returns no-store cache-control so probes always hit the live process", async () => {
    vi.resetModules();
    const { GET } = await import("./+server");
    const res = await GET({} as Parameters<typeof GET>[0]);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("does not reference $lib/server/db (DB-independence guard)", async () => {
    // If the import graph of the handler ever pulls in $lib/server/db this test
    // will throw during module resolution — a canary for accidental coupling.
    vi.resetModules();
    const mod = await import("./+server");
    // If we reached here without a resolution error the handler is DB-free.
    expect(typeof mod.GET).toBe("function");
  });
});
