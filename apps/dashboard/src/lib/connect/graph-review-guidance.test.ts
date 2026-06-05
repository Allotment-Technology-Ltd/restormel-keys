import { describe, expect, it } from "vitest";
import {
  graphReviewGuidance,
  isSuggestedReviewAction,
  reviewActionFillClass,
} from "./graph-review-guidance";

describe("graphReviewGuidance", () => {
  it("suggests weak action and neon fill for weak verdict", () => {
    const g = graphReviewGuidance("weak", "Overstates causal link.");
    expect(g.suggestedAction).toBe("weak");
    expect(g.headline).toContain("weak");
    expect(g.detail).toBe("Overstates causal link.");
    expect(reviewActionFillClass("weak", g.suggestedAction)).toBe("brutal-btn-primary");
    expect(reviewActionFillClass("ok", g.suggestedAction)).toBe("brutal-btn-outline");
    expect(isSuggestedReviewAction("weak", g.suggestedAction)).toBe(true);
  });

  it("suggests unsupported for unsupported verdict", () => {
    const g = graphReviewGuidance("unsupported", null);
    expect(g.suggestedAction).toBe("unsupported");
    expect(reviewActionFillClass("unsupported", g.suggestedAction)).toBe("brutal-btn-primary");
  });

  it("does not pre-select when unchecked", () => {
    const g = graphReviewGuidance("unvalidated", null);
    expect(g.suggestedAction).toBeNull();
    expect(reviewActionFillClass("weak", g.suggestedAction)).toBe("brutal-btn-outline");
  });
});
