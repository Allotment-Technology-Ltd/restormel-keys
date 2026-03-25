import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCanonicalCatalog,
  fetchCanonicalCatalogWithFallback,
  filterCanonicalCatalogForViability,
  policyAvailabilityMapFromEntries,
  resolve,
  isResolveIncomplete,
  validateRouteBinding,
} from "./client.js";

describe("policyAvailabilityMapFromEntries", () => {
  it("marks policy blocks as hard enforcement", () => {
    const map = policyAvailabilityMapFromEntries([
      {
        providerType: "openai",
        modelId: "gpt-4o",
        status: "blocked_by_policy",
        message: "Blocked by policy",
      },
    ]);
    expect(map["openai:gpt-4o"]).toMatchObject({
      available: false,
      enforcement: "hard",
    });
  });

  it("marks degraded/unknown checks as soft enforcement", () => {
    const map = policyAvailabilityMapFromEntries([
      {
        providerType: "openai",
        modelId: "gpt-4o-mini",
        status: "restormel_degraded",
        message: "fetch failed",
      },
      {
        providerType: "anthropic",
        modelId: "claude-3-5-sonnet",
        status: "unknown_or_unavailable",
        message: "403",
      },
    ]);
    expect(map["openai:gpt-4o-mini"]).toMatchObject({
      available: false,
      enforcement: "soft",
    });
    expect(map["anthropic:claude-3-5-sonnet"]).toMatchObject({
      available: false,
      enforcement: "soft",
    });
  });
});

describe("fetchCanonicalCatalog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns canonical catalog from Restormel endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          contractVersion: "2026-03-25.catalog.v5",
          source: "restormel-keys",
          generatedAt: "2026-03-20T00:00:00.000Z",
          providers: [{ id: "openai", displayName: "OpenAI", modelCount: 1, validation: { mode: "native", requiresBaseUrl: false, requiresModel: true } }],
          data: [{ id: "gpt-4o", canonicalName: "gpt-4o", family: "gpt-4", lifecycleState: "active", providerTypes: ["openai"], variants: [] }],
          paging: { limit: 500, offset: 0, count: 1 },
        }),
      })
    );

    const catalog = await fetchCanonicalCatalog({ baseUrl: "https://example.test" });
    expect(catalog.contractVersion).toBe("2026-03-25.catalog.v5");
    expect(catalog.providers[0]?.id).toBe("openai");
  });

  it("passes includeUnhealthy=1 when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        contractVersion: "2026-03-25.catalog.v5",
        source: "restormel-keys",
        generatedAt: "2026-03-20T00:00:00.000Z",
        providers: [],
        data: [],
        paging: { limit: 10, offset: 0, count: 0 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchCanonicalCatalog({
      baseUrl: "https://example.test",
      limit: 10,
      includeUnhealthy: true,
    });

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(calledUrl).toContain("includeUnhealthy=1");
  });

  it("passes skipDefaultAllowlist=1 when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        contractVersion: "2026-03-25.catalog.v5",
        source: "restormel-keys",
        generatedAt: "2026-03-20T00:00:00.000Z",
        providers: [],
        data: [],
        paging: { limit: 10, offset: 0, count: 0 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchCanonicalCatalog({
      baseUrl: "https://example.test",
      skipDefaultAllowlist: true,
    });

    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(calledUrl).toContain("skipDefaultAllowlist=1");
  });

  it("uses fallback when canonical feed is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: "unavailable" }),
      })
    );

    const result = await fetchCanonicalCatalogWithFallback({
      baseUrl: "https://example.test",
      fallback: () => ({
        contractVersion: "fallback.v1",
        source: "restormel-keys",
        generatedAt: "2026-03-20T00:00:00.000Z",
        providers: [],
        data: [],
        paging: { limit: 0, offset: 0, count: 0 },
      }),
    });

    expect(result.source).toBe("fallback");
    expect(result.catalog.contractVersion).toBe("fallback.v1");
    expect(result.degradedReason).toContain("unavailable");
  });
});

describe("filterCanonicalCatalogForViability", () => {
  it("drops deprecated/retired and unavailable variants by default", () => {
    const filtered = filterCanonicalCatalogForViability({
      contractVersion: "2026-03-25.catalog.v5",
      source: "restormel-keys",
      generatedAt: "2026-03-20T00:00:00.000Z",
      providers: [
        { id: "openai", displayName: "OpenAI", modelCount: 3, validation: { mode: "native", requiresBaseUrl: false, requiresModel: true } },
      ],
      data: [
        {
          id: "gpt-4o",
          canonicalName: "gpt-4o",
          family: "gpt-4",
          lifecycleState: "active",
          providerTypes: ["openai"],
          variants: [{ id: "v1", providerType: "openai", providerModelId: "gpt-4o", availabilityStatus: "available" }],
        },
        {
          id: "deprecated-model",
          canonicalName: "deprecated-model",
          family: "legacy",
          lifecycleState: "deprecated",
          providerTypes: ["openai"],
          variants: [{ id: "v2", providerType: "openai", providerModelId: "deprecated-model", availabilityStatus: "available" }],
        },
        {
          id: "preview-model",
          canonicalName: "preview-model",
          family: "preview",
          lifecycleState: "preview",
          providerTypes: ["openai"],
          variants: [{ id: "v3", providerType: "openai", providerModelId: "preview-model", availabilityStatus: "unavailable" }],
        },
      ],
      paging: { limit: 500, offset: 0, count: 3 },
    });

    expect(filtered.data.map((m) => m.id)).toEqual(["gpt-4o"]);
    expect(filtered.data[0]?.variants.map((v) => v.id)).toEqual(["v1"]);
    expect(filtered.providers[0]?.modelCount).toBe(1);
  });

  it("supports explicit include overrides and retired id blocklist", () => {
    const filtered = filterCanonicalCatalogForViability(
      {
        contractVersion: "2026-03-25.catalog.v5",
        source: "restormel-keys",
        generatedAt: "2026-03-20T00:00:00.000Z",
        providers: [
          { id: "openai", displayName: "OpenAI", modelCount: 2, validation: { mode: "native", requiresBaseUrl: false, requiresModel: true } },
        ],
        data: [
          {
            id: "retired-model",
            canonicalName: "retired-model",
            family: "legacy",
            lifecycleState: "retired",
            providerTypes: ["openai"],
            variants: [{ id: "v4", providerType: "openai", providerModelId: "retired-model", availabilityStatus: "unavailable" }],
          },
          {
            id: "still-good",
            canonicalName: "still-good",
            family: "gpt",
            lifecycleState: "active",
            providerTypes: ["openai"],
            variants: [{ id: "v5", providerType: "openai", providerModelId: "still-good", availabilityStatus: "available" }],
          },
        ],
        paging: { limit: 500, offset: 0, count: 2 },
      },
      {
        includeDeprecatedOrRetiredModels: true,
        includeUnavailableVariants: true,
        knownRetiredModelIds: ["retired-model"],
      }
    );

    expect(filtered.data.map((m) => m.id)).toEqual(["still-good"]);
  });
});

describe("validateRouteBinding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns bindingOk and reasons on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { ok: true, reasons: [] } }),
      })
    );

    const r = await validateRouteBinding({
      baseUrl: "https://example.test",
      projectId: "p1",
      routeId: "route-1",
      environmentId: "env-1",
      auth: { type: "bearer", token: "rk_test" },
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bindingOk).toBe(true);
      expect(r.reasons).toEqual([]);
    }
  });

  it("returns bindingOk false with reasons when server reports mismatch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { ok: false, reasons: ["environment_mismatch", "route_unpublished"] },
        }),
      })
    );

    const r = await validateRouteBinding({
      baseUrl: "https://example.test",
      projectId: "p1",
      routeId: "route-1",
      environmentId: "env-1",
      workload: "ingestion",
      stage: "ingestion_extraction",
      auth: { type: "bearer", token: "rk_test" },
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bindingOk).toBe(false);
      expect(r.reasons).toEqual(["environment_mismatch", "route_unpublished"]);
    }
  });

  it("returns ok false on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "unauthorized", message: "Unauthorized" }),
      })
    );

    const r = await validateRouteBinding({
      baseUrl: "https://example.test",
      projectId: "p1",
      routeId: "route-1",
      environmentId: "env-1",
      auth: { type: "bearer", token: "rk_test" },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(401);
      expect(r.error).toBe("unauthorized");
    }
  });
});

describe("resolve", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes task in JSON body when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          routeId: "r1",
          modelId: "gpt-4o",
          explanation: "ok",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await resolve({
      baseUrl: "https://example.test",
      projectId: "p1",
      environmentId: "env-1",
      task: "extract_entities",
      auth: { type: "bearer", token: "rk_test" },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(body.task).toBe("extract_entities");
  });

  it("isResolveIncomplete is true for resolve_incomplete errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: "resolve_incomplete", message: "incomplete" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await resolve({
      baseUrl: "https://example.test",
      projectId: "p1",
      environmentId: "env-1",
      auth: { type: "bearer", token: "rk_test" },
    });

    expect(r.ok).toBe(false);
    expect(isResolveIncomplete(r)).toBe(true);
  });
});
