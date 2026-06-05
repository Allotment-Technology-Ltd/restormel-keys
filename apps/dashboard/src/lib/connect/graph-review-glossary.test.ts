import { describe, expect, it } from "vitest";
import { buildGraphReviewGlossarySections } from "./graph-review-glossary";

describe("buildGraphReviewGlossarySections", () => {
  it("includes auto-remediation section when requested", () => {
    const withRevalidate = buildGraphReviewGlossarySections({ includeRevalidate: true });
    expect(withRevalidate.some((s) => s.id === "auto-remediate")).toBe(true);
    const without = buildGraphReviewGlossarySections({ includeRevalidate: false });
    expect(without.some((s) => s.id === "auto-remediate")).toBe(false);
  });
});
