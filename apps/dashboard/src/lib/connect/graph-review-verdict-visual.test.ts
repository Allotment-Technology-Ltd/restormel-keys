import { describe, expect, it } from "vitest";
import { graphReviewVerdictId, graphReviewVerdictVisual } from "./graph-review-verdict-visual";

describe("graphReviewVerdictVisual", () => {
  it("maps known validation statuses to distinct visual ids", () => {
    expect(graphReviewVerdictId("ok")).toBe("ok");
    expect(graphReviewVerdictId("weak")).toBe("weak");
    expect(graphReviewVerdictId("unsupported")).toBe("unsupported");
    expect(graphReviewVerdictId(null)).toBe("unknown");
  });

  it("assigns unique row classes per verdict", () => {
    const classes = new Set(
      ["ok", "weak", "unsupported", null].map((s) => graphReviewVerdictVisual(s).rowClass),
    );
    expect(classes.size).toBe(4);
  });
});
