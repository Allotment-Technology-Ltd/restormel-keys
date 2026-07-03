import { describe, expect, it } from "vitest";
import { getEnabledSuiteToolNames, RESTORMEL_SUITE_TOOL_NAMES } from "./suite-tool-names.js";

describe("getEnabledSuiteToolNames", () => {
  it("returns all tools when modules enabled", () => {
    const names = getEnabledSuiteToolNames({
      connect: true,
      testing: true,
      graph: "enabled",
    });
    expect(names).toEqual([...RESTORMEL_SUITE_TOOL_NAMES]);
  });

  it("filters connect and testing tools when modules off", () => {
    const names = getEnabledSuiteToolNames({
      connect: false,
      testing: false,
      graph: "disabled",
    });
    expect(names).not.toContain("connect.verify");
    expect(names).not.toContain("testing.config_validate");
    expect(names).not.toContain("graph.fixture_validate");
    expect(names).toContain("docs.canonical_resolve");
    expect(names).toContain("routing.capabilities");
  });

  it("includes graph tool in preview mode", () => {
    const names = getEnabledSuiteToolNames({ graph: "preview" });
    expect(names).toContain("graph.fixture_validate");
  });
});
