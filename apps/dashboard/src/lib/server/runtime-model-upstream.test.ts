import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveVendorOpenAiChatModelId } from "./runtime-model-upstream";

vi.mock("$lib/server/db", () => ({
  listProviderModelVariants: vi.fn(),
}));

import { listProviderModelVariants } from "$lib/server/db";

describe("resolveVendorOpenAiChatModelId", () => {
  beforeEach(() => {
    vi.mocked(listProviderModelVariants).mockReset();
  });

  it("uses catalog variant providerModelId for Together", async () => {
    vi.mocked(listProviderModelVariants).mockResolvedValue([
      {
        id: "claude-sonnet-4-6-together",
        modelId: "claude-sonnet-4-6",
        providerIntegrationType: "together",
        providerModelId: "anthropic/claude-sonnet-4-6",
        catalogProviderId: "together",
        availabilityStatus: "available",
      },
    ] as never);

    const upstream = await resolveVendorOpenAiChatModelId("together", "claude-sonnet-4-6");
    expect(upstream).toBe("anthropic/claude-sonnet-4-6");
  });

  it("falls back to gateway map when variant row is missing", async () => {
    vi.mocked(listProviderModelVariants).mockResolvedValue([] as never);
    const upstream = await resolveVendorOpenAiChatModelId("together", "gpt-5.2");
    expect(upstream).toBe("openai/gpt-5.4");
  });

  it("maps Together embedding catalog id to serverless upstream string", async () => {
    vi.mocked(listProviderModelVariants).mockResolvedValue([] as never);
    const upstream = await resolveVendorOpenAiChatModelId(
      "together",
      "together-multilingual-e5-large",
    );
    expect(upstream).toBe("intfloat/multilingual-e5-large-instruct");
  });
});
