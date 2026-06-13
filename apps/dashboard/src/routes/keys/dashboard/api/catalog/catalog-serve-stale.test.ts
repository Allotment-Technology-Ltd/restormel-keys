/**
 * Serve-stale / degraded catalog tests.
 *
 * These tests live in a SEPARATE file so that each test can use vi.resetModules()
 * + vi.doMock() (not hoisted) to get a fresh module instance with a clean
 * module-level last-known-good cache.  Mixing them with catalog-api.test.ts
 * would share the hoisted top-level mocks and contaminate the cache state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KEYS_API_TEST_MODULE_FLAGS } from "$lib/module-flags-types";

function recentExternalPayload() {
  const fetchedAt = new Date().toISOString();
  return {
    openRouter: { source: "", ok: true, modelCount: 0, fetchedAt },
    providerStatus: {
      openai: { statusUrl: "", ok: true, indicator: "none", description: "", fetchedAt },
      anthropic: { statusUrl: "", ok: true, indicator: "none", description: "", fetchedAt },
    },
  };
}

function mockEvent(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    url: new URL("http://localhost/keys/v1/catalog"),
    ...overrides,
  };
}

/** Sets up a fresh module environment with vi.doMock (not hoisted) for a single test. */
async function setupFreshModule(
  listModelsImpl: () => Promise<unknown[]>,
) {
  vi.resetModules();

  vi.doMock("$lib/server/module-flags", () => ({
    resolveModuleFlagsSync: vi.fn(() => KEYS_API_TEST_MODULE_FLAGS),
  }));

  vi.doMock("$lib/server/catalog-external-signals", () => ({
    buildExternalSignalsFreshness: () => ({ allFresh: true }),
    loadCatalogExternalContext: vi.fn().mockResolvedValue({
      payload: recentExternalPayload(),
      openRouterListedIds: null,
    }),
    getOpenRouterEndpointHealthByModel: vi.fn().mockResolvedValue({}),
  }));

  vi.doMock("$lib/server/db", () => ({
    listModels: vi.fn().mockImplementation(listModelsImpl),
    listProviderModelVariantsByModelIds: vi.fn().mockResolvedValue([]),
    listCatalogModelObservationsForPairs: vi.fn().mockResolvedValue(new Map()),
  }));

  // Import after mocks are registered so module-level cache is fresh.
  const { GET } = await import("./+server");
  return GET;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /keys/v1/catalog — serve-stale on DB error", () => {
  it("returns 503 with valid contract envelope when DB fails on cold start (no prior success)", async () => {
    const handler = await setupFreshModule(async () => {
      throw new Error("Neon 402: quota exceeded");
    });

    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.degraded).toBe(true);
    expect(body.degradedReason).toBe("db_error_cold_start");
    // Contract shape must be present even on cold-start degraded.
    expect(body.contract_version).toBe("2026-03-26.catalog.v6");
    expect(Array.isArray(body.providers)).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.paging).toBeDefined();
  });

  it("serves last-known-good (200 + degraded flag) after a prior successful response", async () => {
    let callCount = 0;
    const handler = await setupFreshModule(async () => {
      callCount++;
      if (callCount === 1) return []; // First call: success
      throw new Error("Neon 402: quota exceeded"); // Subsequent calls: DB down
    });

    // First call: happy path — populates the in-process cache.
    const res1 = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.degraded).toBeUndefined();
    expect(body1.contract_version).toBe("2026-03-26.catalog.v6");

    // Second call: DB is down — must serve stale (not 500).
    const res2 = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.degraded).toBe(true);
    expect(body2.degradedReason).toBe("db_error");
    // Contract shape preserved.
    expect(body2.contract_version).toBe("2026-03-26.catalog.v6");
    expect(Array.isArray(body2.providers)).toBe(true);
    expect(Array.isArray(body2.data)).toBe(true);
    // Degraded signal header.
    expect(res2.headers.get("x-catalog-degraded")).toBe("true");
    // Short re-validation TTL.
    expect(res2.headers.get("cache-control")).toContain("max-age=30");
  });

  it("preserves exact external contract fields (contract_version, compatibility, source, paging) on stale path", async () => {
    let firstCall = true;
    const handler = await setupFreshModule(async () => {
      if (firstCall) { firstCall = false; return []; }
      throw new Error("DB gone");
    });

    // Seed the in-process cache with a successful response.
    await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);

    // Now trigger a stale response.
    const staleRes = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    const staleBody = await staleRes.json();

    expect(staleBody.contract_version).toBe("2026-03-26.catalog.v6");
    expect(staleBody.compatibility).toMatchObject({
      minCliVersion: "0.1.4",
      minCoreDashboardVersion: "0.2.7",
    });
    expect(staleBody.source).toBe("restormel-keys");
    expect(typeof staleBody.paging).toBe("object");
    expect(staleBody.paging.limit).toBeGreaterThan(0);
  });

  it("happy path response does NOT include degraded field", async () => {
    const handler = await setupFreshModule(async () => []);

    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.degraded).toBeUndefined();
    expect(body.contract_version).toBe("2026-03-26.catalog.v6");
    // Cache-Control must be set on happy path.
    expect(res.headers.get("cache-control")).toContain("max-age=60");
  });
});
