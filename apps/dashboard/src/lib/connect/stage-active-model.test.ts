import { describe, expect, it } from "vitest";
import { matchActiveToRecommended } from "./stage-active-model";

describe("matchActiveToRecommended", () => {
  it("returns not_configured when active model missing", () => {
    expect(matchActiveToRecommended(null, { modelId: "gpt-5.2", provider: "openai" })).toBe("not_configured");
    expect(matchActiveToRecommended({ modelId: "", provider: "openai" }, null)).toBe("not_configured");
  });

  it("returns recommended when model and provider match", () => {
    expect(
      matchActiveToRecommended(
        { modelId: "gpt-5.2", provider: "openai" },
        { modelId: "gpt-5.2", provider: "openai" },
      ),
    ).toBe("recommended");
    expect(
      matchActiveToRecommended(
        { modelId: "GPT-5.2", provider: "OpenAI" },
        { modelId: "gpt-5.2", provider: "openai" },
      ),
    ).toBe("recommended");
  });

  it("returns custom when model or provider differs", () => {
    expect(
      matchActiveToRecommended(
        { modelId: "gpt-4o", provider: "openai" },
        { modelId: "gpt-5.2", provider: "openai" },
      ),
    ).toBe("custom");
    expect(
      matchActiveToRecommended(
        { modelId: "gpt-5.2", provider: "anthropic" },
        { modelId: "gpt-5.2", provider: "openai" },
      ),
    ).toBe("custom");
  });

  it("returns custom when no recommendation exists", () => {
    expect(matchActiveToRecommended({ modelId: "gpt-4o", provider: "openai" }, null)).toBe("custom");
  });
});
