import { describe, it, expect, vi } from "vitest";

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
    expect(body.contractVersion).toBe("2026-03-23.catalog.v1");
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

  it("filters deprecated/retired and unavailable variants by default", async () => {
    const { listModels, listProviderModelVariantsByModelIds } = await import("$lib/server/db");
    vi.mocked(listModels).mockResolvedValue([
      { ...mockModel, id: "active-model", canonicalName: "active-model", lifecycleState: "active" } as never,
      { ...mockModel, id: "deprecated-model", canonicalName: "deprecated-model", lifecycleState: "deprecated" } as never,
      { ...mockModel, id: "retired-model", canonicalName: "retired-model", lifecycleState: "retired" } as never,
      { ...mockModel, id: "active-no-available", canonicalName: "active-no-available", lifecycleState: "active" } as never,
    ]);
    vi.mocked(listProviderModelVariantsByModelIds).mockResolvedValue([
      {
        id: "v-active-1",
        modelId: "active-model",
        providerIntegrationType: "openai",
        providerModelId: "active-model",
        availabilityStatus: "available",
      } as never,
      {
        id: "v-depr-1",
        modelId: "deprecated-model",
        providerIntegrationType: "openai",
        providerModelId: "deprecated-model",
        availabilityStatus: "available",
      } as never,
      {
        id: "v-ret-1",
        modelId: "retired-model",
        providerIntegrationType: "openai",
        providerModelId: "retired-model",
        availabilityStatus: "available",
      } as never,
      {
        id: "v-active-2",
        modelId: "active-no-available",
        providerIntegrationType: "openai",
        providerModelId: "active-no-available",
        availabilityStatus: "unavailable",
      } as never,
    ]);

    const { GET: handler } = await import("./+server");
    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((m: { id: string }) => m.id)).toEqual(["active-model"]);
    expect(body.providers.map((p: { id: string }) => p.id)).toEqual(["openai"]);
  });

  it("can include unhealthy models/variants for diagnostics", async () => {
    const { listModels, listProviderModelVariantsByModelIds } = await import("$lib/server/db");
    vi.mocked(listModels).mockResolvedValue([
      { ...mockModel, id: "deprecated-model", canonicalName: "deprecated-model", lifecycleState: "deprecated" } as never,
    ]);
    vi.mocked(listProviderModelVariantsByModelIds).mockResolvedValue([
      {
        id: "v-depr-1",
        modelId: "deprecated-model",
        providerIntegrationType: "openai",
        providerModelId: "deprecated-model",
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
    const { listModels, listProviderModelVariantsByModelIds } = await import("$lib/server/db");
    vi.mocked(listModels).mockResolvedValue([
      { ...mockModel, id: "meta-llama/1", canonicalName: "meta-llama/1", lifecycleState: "active" } as never,
    ]);
    vi.mocked(listProviderModelVariantsByModelIds).mockResolvedValue([
      {
        id: "v-or-1",
        modelId: "meta-llama/1",
        providerIntegrationType: "openrouter",
        providerModelId: "meta-llama/1",
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
});
