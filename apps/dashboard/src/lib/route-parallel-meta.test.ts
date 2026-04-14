import { describe, it, expect } from "vitest";
import { routeRequiresParallelFanout } from "$lib/route-parallel-meta";

describe("routeRequiresParallelFanout", () => {
  it("returns false for linear steps", () => {
    expect(
      routeRequiresParallelFanout([
        { enabled: true, parallelGroupId: null },
        { enabled: true, parallelGroupId: null },
      ])
    ).toBe(false);
  });

  it("returns false when only one step uses a group id", () => {
    expect(
      routeRequiresParallelFanout([
        { enabled: true, parallelGroupId: "g1" },
        { enabled: true, parallelGroupId: null },
      ])
    ).toBe(false);
  });

  it("returns true when two enabled steps share a group", () => {
    expect(
      routeRequiresParallelFanout([
        { enabled: true, parallelGroupId: "g1" },
        { enabled: true, parallelGroupId: "g1" },
      ])
    ).toBe(true);
  });

  it("ignores disabled steps", () => {
    expect(
      routeRequiresParallelFanout([
        { enabled: false, parallelGroupId: "g1" },
        { enabled: true, parallelGroupId: "g1" },
      ])
    ).toBe(false);
  });
});
