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
    expect(body.contractVersion).toBe("2026-03-20.catalog.v1");
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
});
