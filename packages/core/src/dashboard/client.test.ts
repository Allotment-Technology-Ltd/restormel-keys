import { describe, expect, it } from "vitest";
import { policyAvailabilityMapFromEntries } from "./client.js";

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
