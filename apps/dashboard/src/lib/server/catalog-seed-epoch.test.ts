import { describe, expect, it } from "vitest";
import { catalogSeedEpochMs } from "./catalog-seed-epoch";

describe("catalogSeedEpochMs", () => {
  it("returns null for empty values", () => {
    expect(catalogSeedEpochMs(null)).toBeNull();
    expect(catalogSeedEpochMs("")).toBeNull();
  });

  it("passes through numeric epoch ms", () => {
    expect(catalogSeedEpochMs(1761696000000)).toBe(1761696000000);
  });

  it("parses ISO date strings to UTC midnight ms", () => {
    expect(catalogSeedEpochMs("2026-06-04")).toBe(Date.parse("2026-06-04T00:00:00.000Z"));
  });

  it("parses numeric strings", () => {
    expect(catalogSeedEpochMs("1761696000000")).toBe(1761696000000);
  });
});
