import { describe, expect, it } from "vitest";
import {
  buildEvalArgs,
  effectiveExitCode,
  EXIT_CONFIG_ERROR,
  EXIT_PASS,
  EXIT_QUALITY_FAIL,
  EXIT_REGRESSION,
  parseBoolean,
  verdictForExitCode,
} from "./gate.js";

describe("buildEvalArgs", () => {
  it("local counts mode with baseline + tolerance", () => {
    expect(
      buildEvalArgs({ countsPath: "counts.json", baselinePath: "base.json", tolerance: "2" }),
    ).toEqual([
      "connect",
      "eval",
      "--output",
      "markdown",
      "--counts",
      "counts.json",
      "--baseline",
      "base.json",
      "--tolerance",
      "2",
    ]);
  });

  it("remote mode passes workspace/project/job/site-base, never the key", () => {
    const args = buildEvalArgs({
      workspace: "ws_1",
      project: "pr_1",
      jobId: "job_9",
      siteBase: "https://restormel.dev",
    });
    expect(args).toEqual([
      "connect",
      "eval",
      "--output",
      "markdown",
      "--job",
      "job_9",
      "--workspace",
      "ws_1",
      "--project",
      "pr_1",
      "--site-base",
      "https://restormel.dev",
    ]);
    // The gateway key travels via env (RESTORMEL_GATEWAY_KEY), never argv.
    expect(args.join(" ")).not.toMatch(/key/i);
  });

  it("omits empty tolerance", () => {
    expect(buildEvalArgs({ countsPath: "c.json", tolerance: "  " })).toEqual([
      "connect",
      "eval",
      "--output",
      "markdown",
      "--counts",
      "c.json",
    ]);
  });
});

describe("verdictForExitCode", () => {
  it("maps the documented CLI contract", () => {
    expect(verdictForExitCode(EXIT_PASS)).toBe("pass");
    expect(verdictForExitCode(EXIT_QUALITY_FAIL)).toBe("quality_fail");
    expect(verdictForExitCode(EXIT_CONFIG_ERROR)).toBe("config_error");
    expect(verdictForExitCode(EXIT_REGRESSION)).toBe("regression");
  });

  it("unknown / missing codes are errors", () => {
    expect(verdictForExitCode(42)).toBe("error");
    expect(verdictForExitCode(null)).toBe("error");
  });
});

describe("effectiveExitCode (warn mode)", () => {
  it("passes codes through when blocking", () => {
    expect(effectiveExitCode(EXIT_QUALITY_FAIL, false)).toBe(EXIT_QUALITY_FAIL);
    expect(effectiveExitCode(EXIT_REGRESSION, false)).toBe(EXIT_REGRESSION);
  });

  it("downgrades quality fail and regression to 0 in warn mode", () => {
    expect(effectiveExitCode(EXIT_QUALITY_FAIL, true)).toBe(EXIT_PASS);
    expect(effectiveExitCode(EXIT_REGRESSION, true)).toBe(EXIT_PASS);
  });

  it("never downgrades config errors or crashes", () => {
    expect(effectiveExitCode(EXIT_CONFIG_ERROR, true)).toBe(EXIT_CONFIG_ERROR);
    expect(effectiveExitCode(null, true)).toBe(1);
    expect(effectiveExitCode(42, true)).toBe(42);
  });
});

describe("parseBoolean", () => {
  it("accepts true/1/yes in any case, rejects everything else", () => {
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("TRUE")).toBe(true);
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("yes")).toBe(true);
    expect(parseBoolean("false")).toBe(false);
    expect(parseBoolean("")).toBe(false);
    expect(parseBoolean(undefined)).toBe(false);
  });
});
