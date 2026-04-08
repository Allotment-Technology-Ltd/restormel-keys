import { describe, expect, it } from "vitest";
import { shouldSkipForkPr } from "./fork-policy.js";

describe("shouldSkipForkPr", () => {
  it("skips when policy is skip and PR is from a fork", () => {
    expect(shouldSkipForkPr("skip", true)).toBe(true);
  });

  it("does not skip same-repo PRs", () => {
    expect(shouldSkipForkPr("skip", false)).toBe(false);
  });

  it("runs on fork when policy is run", () => {
    expect(shouldSkipForkPr("run", true)).toBe(false);
  });
});
