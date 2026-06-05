import { describe, expect, it } from "vitest";
import {
  hasTogetherGatewayForModel,
  remapRecommendationViaTogether,
  togetherUpstreamModelId,
} from "./together-ingest-gateway";

describe("together-ingest-gateway", () => {
  it("maps canonical Claude and GPT ids to Together upstream strings", () => {
    expect(togetherUpstreamModelId("claude-sonnet-4-6")).toBe("anthropic/claude-sonnet-4-6");
    expect(togetherUpstreamModelId("gpt-5.2")).toBe("openai/gpt-5.4");
    expect(hasTogetherGatewayForModel("gemini-3.1-pro")).toBe(true);
  });

  it("remaps direct-provider recommendations when only Together is connected", () => {
    const remapped = remapRecommendationViaTogether(
      {
        modelId: "claude-sonnet-4-6",
        provider: "anthropic",
        tier: "production",
        rationale: "Best faithfulness",
      },
      new Set(["together"]),
    );
    expect(remapped?.provider).toBe("together");
    expect(remapped?.modelId).toBe("claude-sonnet-4-6");
    expect(remapped?.rationale).toMatch(/Together AI/);
  });

  it("keeps direct provider when that key is also connected", () => {
    const kept = remapRecommendationViaTogether(
      {
        modelId: "claude-sonnet-4-6",
        provider: "anthropic",
        tier: "production",
        rationale: "Best faithfulness",
      },
      new Set(["anthropic", "together"]),
    );
    expect(kept?.provider).toBe("anthropic");
  });
});
