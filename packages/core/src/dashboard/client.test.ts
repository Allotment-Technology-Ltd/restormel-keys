import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCanonicalCatalog,
  fetchCanonicalCatalogWithFallback,
  filterCanonicalCatalogForViability,
  policyAvailabilityMapFromEntries,
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
          contractVersion: "2026-03-23.catalog.v1",
          source: "restormel-keys",
          generatedAt: "2026-03-20T00:00:00.000Z",
          providers: [{ id: "openai", displayName: "OpenAI", modelCount: 1, validation: { mode: "native", requiresBaseUrl: false, requiresModel: true } }],
          data: [{ id: "gpt-4o", canonicalName: "gpt-4o", family: "gpt-4", lifecycleState: "active", providerTypes: ["openai"], variants: [] }],
          paging: { limit: 500, offset: 0, count: 1 },
        }),
      })
    );

    const catalog = await fetchCanonicalCatalog({ baseUrl: "https://example.test" });
    expect(catalog.contractVersion).toBe("2026-03-23.catalog.v1");
    expect(catalog.providers[0]?.id).toBe("openai");
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
      contractVersion: "2026-03-23.catalog.v1",
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
        contractVersion: "2026-03-23.catalog.v1",
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
