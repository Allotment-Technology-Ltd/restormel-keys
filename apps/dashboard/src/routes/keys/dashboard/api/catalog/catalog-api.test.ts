import { describe, it, expect, vi } from "vitest";

function recentExternalPayload() {
  const fetchedAt = new Date().toISOString();
  return {
    openRouter: {
      source: "https://openrouter.ai/api/v1/models",
      ok: true,
      modelCount: 0,
      fetchedAt,
    },
    providerStatus: {
      openai: {
        statusUrl: "https://status.openai.com/",
        ok: true,
        indicator: "none",
        description: "All Systems Operational",
        fetchedAt,
      },
      anthropic: {
        statusUrl: "https://status.anthropic.com/",
        ok: true,
        indicator: "none",
        description: "All Systems Operational",
        fetchedAt,
      },
    },
  };
}

const mockLoadCatalogExternalContext = vi.fn().mockImplementation(async () => ({
  payload: recentExternalPayload(),
  openRouterListedIds: null,
}));
const mockGetOpenRouterEndpointHealthByModel = vi.fn().mockResolvedValue({});

vi.mock("$lib/server/catalog-external-signals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("$lib/server/catalog-external-signals")>();
  return {
    ...actual,
    loadCatalogExternalContext: mockLoadCatalogExternalContext,
    getOpenRouterEndpointHealthByModel: mockGetOpenRouterEndpointHealthByModel,
  };
});

const mockModel = {
  id: "gpt-4o",
  canonicalName: "gpt-4o",
  family: "gpt-4",
  lifecycleState: "active",
  description: null,
  modalities: ["text"],
  capabilities: ["chat"],
  contextWindow: 128000,
  maxOutputTokens: 16384,
  supportsTools: true,
  supportsStructuredOutput: true,
  supportsMcp: null,
  editorialSummary: null,
  strengths: null,
  weaknesses: null,
  recommendedFor: null,
  avoidFor: null,
  deprecationDate: null,
  retirementDate: null,
  replacementModelId: null,
  sourceLastVerifiedAt: null,
};

vi.mock("$lib/server/db", () => ({
  listModels: vi.fn().mockResolvedValue([]),
  listProviderModelVariantsByModelIds: vi.fn().mockResolvedValue([]),
  listCatalogModelObservationsForPairs: vi.fn().mockResolvedValue(new Map()),
}));

function mockEvent(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    url: new URL("http://localhost/api/catalog"),
    ...overrides,
  };
}

describe("GET /api/catalog", () => {
  it("returns versioned canonical catalog shape", async () => {
    mockLoadCatalogExternalContext.mockImplementation(async () => ({
      payload: recentExternalPayload(),
      openRouterListedIds: null,
    }));
    const { listModels, listProviderModelVariantsByModelIds } = await import("$lib/server/db");
    vi.mocked(listModels).mockResolvedValue([mockModel as never]);
    vi.mocked(listProviderModelVariantsByModelIds).mockResolvedValue([
      {
        id: "var-1",
        modelId: "gpt-4o",
        providerIntegrationType: "openai",
        providerModelId: "gpt-4o",
        availabilityStatus: "available",
      } as never,
    ]);

    const { GET: handler } = await import("./+server");
    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contractVersion).toBe("2026-03-26.catalog.v6");
    expect(body.compatibility).toMatchObject({
      minCliVersion: "0.1.4",
      minCoreDashboardVersion: "0.2.7",
    });
    expect(body.externalSignals.freshness).toMatchObject({
      allFresh: true,
      slo: {
        openRouterModelsMaxAgeMs: 15 * 60 * 1000,
        providerStatusMaxAgeMs: 5 * 60 * 1000,
        openRouterEndpointHealthMaxAgeMs: 10 * 60 * 1000,
      },
    });
    expect(body.externalSignals).toMatchObject({
      openRouter: { ok: true },
      providerStatus: {
        openai: { ok: true },
        anthropic: { ok: true },
      },
    });
    expect(Array.isArray(body.providers)).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.providers[0]).toMatchObject({
      id: "openai",
      displayName: "OpenAI",
    });
    expect(body.data[0]).toMatchObject({
      id: "gpt-4o",
      providerTypes: ["openai"],
    });
  });

  it("filters deprecated/retired, unavailable variants, and non-default-provider models by default", async () => {
    mockLoadCatalogExternalContext.mockImplementation(async () => ({
      payload: recentExternalPayload(),
      openRouterListedIds: null,
    }));
    const { listModels, listProviderModelVariantsByModelIds } = await import("$lib/server/db");
    // listModels applies viability in production; mock matches that contract for default catalog GET.
    vi.mocked(listModels).mockResolvedValue([
      { ...mockModel, id: "gpt-4o", canonicalName: "gpt-4o", lifecycleState: "active" } as never,
      { ...mockModel, id: "gpt-4o-mini", canonicalName: "gpt-4o-mini", lifecycleState: "active" } as never,
    ]);
    vi.mocked(listProviderModelVariantsByModelIds).mockResolvedValue([
      {
        id: "v-active-1",
        modelId: "gpt-4o",
        providerIntegrationType: "openai",
        providerModelId: "gpt-4o",
        availabilityStatus: "available",
      } as never,
      {
        id: "v-depr-1",
        modelId: "deprecated-model",
        providerIntegrationType: "openai",
        providerModelId: "gpt-4o",
        availabilityStatus: "available",
      } as never,
      {
        id: "v-ret-1",
        modelId: "retired-model",
        providerIntegrationType: "openai",
        providerModelId: "gpt-4o",
        availabilityStatus: "available",
      } as never,
      {
        id: "v-active-2",
        modelId: "gpt-4o-mini",
        providerIntegrationType: "openai",
        providerModelId: "not-in-default-providers",
        availabilityStatus: "available",
      } as never,
    ]);

    const { GET: handler } = await import("./+server");
    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((m: { id: string }) => m.id)).toEqual(["gpt-4o"]);
    expect(body.providers.map((p: { id: string }) => p.id)).toEqual(["openai"]);
  });

  it("can include unhealthy models/variants for diagnostics", async () => {
    mockLoadCatalogExternalContext.mockImplementation(async () => ({
      payload: recentExternalPayload(),
      openRouterListedIds: null,
    }));
    const { listModels, listProviderModelVariantsByModelIds } = await import("$lib/server/db");
    vi.mocked(listModels).mockResolvedValue([
      { ...mockModel, id: "deprecated-model", canonicalName: "deprecated-model", lifecycleState: "deprecated" } as never,
    ]);
    vi.mocked(listProviderModelVariantsByModelIds).mockResolvedValue([
      {
        id: "v-depr-1",
        modelId: "deprecated-model",
        providerIntegrationType: "openai",
        providerModelId: "gpt-4o",
        availabilityStatus: "unavailable",
      } as never,
    ]);

    const { GET: handler } = await import("./+server");
    const res = await handler(
      mockEvent({ url: new URL("http://localhost/api/catalog?includeUnhealthy=1") }) as unknown as Parameters<
        typeof handler
      >[0]
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((m: { id: string }) => m.id)).toEqual(["deprecated-model"]);
    expect(body.data[0].variants[0].availabilityStatus).toBe("unavailable");
  });

  it("includes defaultApiBaseUrl for openai_compatible providers with a known public endpoint", async () => {
    mockLoadCatalogExternalContext.mockImplementation(async () => ({
      payload: recentExternalPayload(),
      openRouterListedIds: new Set(["meta-llama/llama-3.3-70b-instruct"]),
    }));
    const { listModels, listProviderModelVariantsByModelIds } = await import("$lib/server/db");
    vi.mocked(listModels).mockResolvedValue([
      {
        ...mockModel,
        id: "meta-llama-llama-3-3-70b",
        canonicalName: "meta-llama-llama-3-3-70b",
        lifecycleState: "active",
      } as never,
    ]);
    vi.mocked(listProviderModelVariantsByModelIds).mockResolvedValue([
      {
        id: "v-or-1",
        modelId: "meta-llama-llama-3-3-70b",
        providerIntegrationType: "openrouter",
        providerModelId: "meta-llama/llama-3.3-70b-instruct",
        availabilityStatus: "available",
      } as never,
    ]);

    const { GET: handler } = await import("./+server");
    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    const openrouter = body.providers.find((p: { id: string }) => p.id === "openrouter");
    expect(openrouter).toBeDefined();
    expect(openrouter.validation.mode).toBe("openai_compatible");
    expect(openrouter.validation.requiresBaseUrl).toBe(false);
    expect(openrouter.validation.defaultApiBaseUrl).toBe("https://openrouter.ai/api/v1");
  });

  it("drops openrouter variants missing from live openrouter public list when snapshot is available", async () => {
    mockLoadCatalogExternalContext.mockImplementation(async () => ({
      payload: recentExternalPayload(),
      openRouterListedIds: new Set(["meta-llama/llama-3.3-70b-instruct"]),
    }));
    const { listModels, listProviderModelVariantsByModelIds } = await import("$lib/server/db");
    vi.mocked(listModels).mockResolvedValue([
      { ...mockModel, id: "m1", canonicalName: "m1", lifecycleState: "active" } as never,
    ]);
    vi.mocked(listProviderModelVariantsByModelIds).mockResolvedValue([
      {
        id: "v-or-keep",
        modelId: "m1",
        providerIntegrationType: "openrouter",
        providerModelId: "meta-llama/llama-3.3-70b-instruct",
        availabilityStatus: "available",
      } as never,
      {
        id: "v-or-drop",
        modelId: "m1",
        providerIntegrationType: "openrouter",
        providerModelId: "no-longer-listed/model",
        availabilityStatus: "available",
      } as never,
    ]);

    const { GET: handler } = await import("./+server");
    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].variants).toHaveLength(1);
    expect(body.data[0].variants[0].providerModelId).toBe("meta-llama/llama-3.3-70b-instruct");
  });
});
