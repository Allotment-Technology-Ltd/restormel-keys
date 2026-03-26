/**
 * Model catalog API: listing and filtering (mocked db).
 */
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
  getModel: vi.fn().mockResolvedValue(null),
  listProviderModelVariants: vi.fn().mockResolvedValue([]),
}));

function mockEvent(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    url: new URL("http://localhost/api/models"),
    ...overrides,
  };
}

describe("GET /api/models", () => {
  it("returns catalog list with data array", async () => {
    const { GET: handler } = await import("./+server");
    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("passes query params to listModels", async () => {
    const { listModels } = await import("$lib/server/db");
    const { GET: handler } = await import("./+server");
    vi.mocked(listModels).mockResolvedValue([mockModel as never]);
    const url = new URL("http://localhost/api/models");
    url.searchParams.set("lifecycleState", "active");
    url.searchParams.set("family", "gpt-4");
    url.searchParams.set("limit", "50");
    url.searchParams.set("offset", "0");
    await handler(mockEvent({ url }) as unknown as Parameters<typeof handler>[0]);
    expect(listModels).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycleState: "active",
        family: "gpt-4",
        limit: 50,
        offset: 0,
        includeUnhealthy: false,
      })
    );
  });

  it("passes includeUnhealthy when requested", async () => {
    const { listModels } = await import("$lib/server/db");
    const { GET: handler } = await import("./+server");
    vi.mocked(listModels).mockResolvedValue([mockModel as never]);
    const url = new URL("http://localhost/api/models");
    url.searchParams.set("includeUnhealthy", "1");
    await handler(mockEvent({ url }) as unknown as Parameters<typeof handler>[0]);
    expect(listModels).toHaveBeenCalledWith(expect.objectContaining({ includeUnhealthy: true }));
  });

  it("clamps limit to 500", async () => {
    const { listModels } = await import("$lib/server/db");
    const { GET: handler } = await import("./+server");
    const url = new URL("http://localhost/api/models");
    url.searchParams.set("limit", "9999");
    await handler(mockEvent({ url }) as unknown as Parameters<typeof handler>[0]);
    expect(listModels).toHaveBeenCalledWith(expect.objectContaining({ limit: 500 }));
  });
});

describe("GET /api/models/[id]", () => {
  it("returns 404 when model not found", async () => {
    const { getModel } = await import("$lib/server/db");
    vi.mocked(getModel).mockResolvedValue(null);
    const { GET: handler } = await import("./[id]/+server");
    const res = await handler(
      mockEvent({ params: { id: "nonexistent" } }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(404);
  });

  it("returns model with variants for frontend catalog object", async () => {
    const { getModel, listProviderModelVariants } = await import("$lib/server/db");
    const variant = {
      id: "v1",
      modelId: "gpt-4o",
      providerIntegrationType: "openai",
      providerModelId: "gpt-4o",
      availabilityStatus: "available",
      pricingRef: null,
      rateLimitRef: null,
      metadata: null,
      sourceLastVerifiedAt: null,
    };
    vi.mocked(getModel).mockResolvedValue(mockModel as never);
    vi.mocked(listProviderModelVariants).mockResolvedValue([variant as never]);
    const { GET: handler } = await import("./[id]/+server");
    const res = await handler(
      mockEvent({ params: { id: "gpt-4o" } }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      id: "gpt-4o",
      canonicalName: "gpt-4o",
      lifecycleState: "active",
    });
    expect(Array.isArray(body.data.variants)).toBe(true);
    expect(body.data.variants[0]).toMatchObject({
      providerIntegrationType: "openai",
      providerModelId: "gpt-4o",
    });
  });
});
