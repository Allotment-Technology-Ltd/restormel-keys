import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCanonicalCatalog,
  fetchCanonicalCatalogWithFallback,
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
          contractVersion: "2026-03-20.catalog.v1",
          source: "restormel-keys",
          generatedAt: "2026-03-20T00:00:00.000Z",
          providers: [{ id: "openai", displayName: "OpenAI", modelCount: 1, validation: { mode: "native", requiresBaseUrl: false, requiresModel: true } }],
          data: [{ id: "gpt-4o", canonicalName: "gpt-4o", family: "gpt-4", lifecycleState: "active", providerTypes: ["openai"], variants: [] }],
          paging: { limit: 500, offset: 0, count: 1 },
        }),
      })
    );

    const catalog = await fetchCanonicalCatalog({ baseUrl: "https://example.test" });
    expect(catalog.contractVersion).toBe("2026-03-20.catalog.v1");
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
