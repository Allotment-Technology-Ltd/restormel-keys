import { describe, expect, it } from "vitest";
import { parseArgs } from "./parse-args.js";

describe("parseArgs", () => {
  it("defaults to help when argv empty", () => {
    expect(parseArgs([])).toEqual({ kind: "help" });
  });

  it("parses run with required suite", () => {
    expect(parseArgs(["run", "--suite", "web", "--config", "foo.yaml"])).toEqual({
      kind: "run",
      suites: ["web"],
      config: "foo.yaml",
      environmentId: undefined,
      targetUrl: undefined,
      commitSha: undefined,
      repository: undefined,
      artifactDir: undefined,
      headless: true,
      trigger: "local",
      goalIds: undefined,
      json: false,
    });
  });

  it("parses run --goal comma-separated", () => {
    expect(parseArgs(["run", "--suite", "s", "--goal", "a,b", "-c", "x.yaml"])).toEqual({
      kind: "run",
      suites: ["s"],
      config: "x.yaml",
      environmentId: undefined,
      targetUrl: undefined,
      commitSha: undefined,
      repository: undefined,
      artifactDir: undefined,
      headless: true,
      trigger: "local",
      goalIds: ["a", "b"],
      json: false,
    });
  });

  it("errors when run omits --suite", () => {
    const p = parseArgs(["run"]);
    expect(p.kind).toBe("error");
    if (p.kind === "error") {
      expect(p.message).toMatch(/suite/);
    }
  });

  it("parses multiple --suite and --suites", () => {
    const p = parseArgs(["run", "--suite", "a", "--suite", "b", "--suites", "c,d", "-c", "x.yaml"]);
    expect(p).toEqual({
      kind: "run",
      suites: ["a", "b", "c", "d"],
      config: "x.yaml",
      environmentId: undefined,
      targetUrl: undefined,
      commitSha: undefined,
      repository: undefined,
      artifactDir: undefined,
      headless: true,
      trigger: "local",
      goalIds: undefined,
      json: false,
    });
  });

  it("parses validate with default config path", () => {
    expect(parseArgs(["validate"])).toEqual({
      kind: "validate",
      config: "restormel-testing.yaml",
      json: false,
    });
  });

  it("parses report positional path", () => {
    expect(parseArgs(["report", "./out/run-1"])).toEqual({ kind: "report", path: "./out/run-1" });
  });

  it("parses init --print", () => {
    expect(parseArgs(["init", "--print"])).toEqual({
      kind: "init",
      config: "restormel-testing.yaml",
      print: true,
      force: false,
    });
  });
});
