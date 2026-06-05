import { describe, expect, it } from "vitest";
import {
  GRAPH_REVIEW_COMMON_STEPS,
  coachingFromAiValidationNote,
  fallbackGraphReviewCoaching,
  parseGraphReviewCoachingResponse,
  verdictLookForHints,
} from "./graph-review-coaching";

describe("parseGraphReviewCoachingResponse", () => {
  it("parses slim LLM coaching JSON", () => {
    const parsed = parseGraphReviewCoachingResponse(
      JSON.stringify({
        focus: "Check whether jubilation is attributed to the text.",
        look_for: ["Find grace language", "Compare secular vs divine"],
      }),
      "full",
    );
    expect(parsed?.generatedBy).toBe("llm");
    expect(parsed?.lookFor).toHaveLength(2);
    expect(parsed?.focus).toContain("jubilation");
  });
});

describe("coachingFromAiValidationNote", () => {
  it("reuses AI validation note without an LLM call", () => {
    const coaching = coachingFromAiValidationNote({
      validationStatus: "unsupported",
      validationNote: "Adds jubilation not stated in source.",
      sourceQuality: "full",
    });
    expect(coaching?.generatedBy).toBe("note");
    expect(coaching?.focus).toContain("jubilation");
    expect(coaching?.lookFor.length).toBeGreaterThan(0);
  });
});

describe("fallbackGraphReviewCoaching", () => {
  it("returns concise fallback when LLM is unavailable", () => {
    const coaching = fallbackGraphReviewCoaching({
      validationStatus: "weak",
      validationNote: null,
      sourceQuality: "preview",
      hasSourceLink: true,
    });
    expect(coaching.generatedBy).toBe("fallback");
    expect(coaching.focus.length).toBeGreaterThan(0);
    expect(coaching.lookFor.length).toBeGreaterThan(0);
  });
});

describe("GRAPH_REVIEW_COMMON_STEPS", () => {
  it("defines a fixed three-step review ritual", () => {
    expect(GRAPH_REVIEW_COMMON_STEPS).toHaveLength(3);
    expect(verdictLookForHints("unsupported", "missing").length).toBeLessThanOrEqual(2);
  });
});
