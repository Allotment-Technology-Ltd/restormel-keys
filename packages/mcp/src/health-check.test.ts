import { describe, it, expect } from "vitest";
import { runMcpHealthCheck } from "./health-check.js";

describe("runMcpHealthCheck", () => {
  it("returns ok manifest with sorted tool names", () => {
    const r = runMcpHealthCheck();
    expect(r.ok).toBe(true);
    expect(r.name).toBe("@restormel/mcp");
    expect(r.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(r.tools.length).toBeGreaterThan(10);
    const names = r.tools.map((t) => t.name);
    expect([...names].sort()).toEqual(names);
  });
});
