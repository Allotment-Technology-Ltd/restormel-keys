import { describe, expect, it } from "vitest";
import { evaluateForkPrPolicy, shouldSkipForkPr } from "./fork-policy.js";

describe("evaluateForkPrPolicy", () => {
  it("runs same-repo PRs regardless of policy", () => {
    expect(evaluateForkPrPolicy("skip", { isForkPr: false, requiredLabelPresent: false })).toEqual({
      execute: true,
      useNeutralExit: false,
    });
  });

  it("skip + fork → no execute, no neutral exit", () => {
    expect(evaluateForkPrPolicy("skip", { isForkPr: true, requiredLabelPresent: false })).toEqual({
      execute: false,
      skipReason: "fork_default",
      useNeutralExit: false,
    });
  });

  it("run + fork → execute", () => {
    expect(evaluateForkPrPolicy("run", { isForkPr: true, requiredLabelPresent: false })).toEqual({
      execute: true,
      useNeutralExit: false,
    });
  });

  it("require_label + fork + no label → skip exit 0 path", () => {
    expect(evaluateForkPrPolicy("require_label", { isForkPr: true, requiredLabelPresent: false })).toEqual({
      execute: false,
      skipReason: "fork_missing_label",
      useNeutralExit: false,
    });
  });

  it("require_label + fork + label → execute", () => {
    expect(evaluateForkPrPolicy("require_label", { isForkPr: true, requiredLabelPresent: true })).toEqual({
      execute: true,
      useNeutralExit: false,
    });
  });

  it("sandbox_only + fork + no label → neutral exit when skipping", () => {
    expect(evaluateForkPrPolicy("sandbox_only", { isForkPr: true, requiredLabelPresent: false })).toEqual({
      execute: false,
      skipReason: "fork_missing_label",
      useNeutralExit: true,
    });
  });
});

describe("shouldSkipForkPr (legacy)", () => {
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
