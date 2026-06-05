import { describe, expect, it } from "vitest";
import { mergeRouteResolveFailure } from "./stage-route-generate";

describe("mergeRouteResolveFailure", () => {
  it("preserves upstream error when resolver exhausts fallback on retry", () => {
    const upstream = new Error("context length exceeded");
    const err = mergeRouteResolveFailure(upstream, 1, {
      code: "no_key_available",
      message: "No further steps to try after previous failure context",
    });
    expect(err.message).toContain("context length exceeded");
    expect(err.message).toContain("Route fallback exhausted after");
    expect(err.message).not.toBe("No further steps to try after previous failure context");
  });

  it("uses resolver message on first attempt failure", () => {
    const err = mergeRouteResolveFailure(undefined, 0, {
      code: "no_key_available",
      message: "No enabled route step available",
    });
    expect(err.message).toBe("No enabled route step available");
  });

  it("uses resolver message on retry when no prior upstream error", () => {
    const err = mergeRouteResolveFailure(undefined, 2, {
      code: "no_key_available",
      message: "No further steps to try after previous failure context",
    });
    expect(err.message).toBe("No further steps to try after previous failure context");
  });
});
