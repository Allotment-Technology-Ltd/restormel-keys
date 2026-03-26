import { describe, it, expect } from "vitest";
import {
  epochMsToIsoOrNull,
  isPastCatalogRetirement,
  isViableCatalogModel,
  isViableCatalogVariantAvailability,
} from "./catalog-viability";

describe("catalog-viability", () => {
  it("treats deprecated and retired lifecycle as non-viable", () => {
    expect(isViableCatalogModel({ lifecycleState: "deprecated", retirementDate: null })).toBe(false);
    expect(isViableCatalogModel({ lifecycleState: "retired", retirementDate: null })).toBe(false);
    expect(isViableCatalogModel({ lifecycleState: "active", retirementDate: null })).toBe(true);
    expect(isViableCatalogModel({ lifecycleState: null, retirementDate: null })).toBe(true);
  });

  it("treats past retirement_date as non-viable even when lifecycle is active", () => {
    const past = Date.now() - 86_400_000;
    expect(isViableCatalogModel({ lifecycleState: "active", retirementDate: past })).toBe(false);
    expect(isPastCatalogRetirement(past, Date.now())).toBe(true);
  });

  it("accepts only available variants by default", () => {
    expect(isViableCatalogVariantAvailability("available")).toBe(true);
    expect(isViableCatalogVariantAvailability("retired")).toBe(false);
    expect(isViableCatalogVariantAvailability("unavailable")).toBe(false);
    expect(isViableCatalogVariantAvailability(null)).toBe(false);
  });

  it("epochMsToIsoOrNull formats finite timestamps", () => {
    expect(epochMsToIsoOrNull(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(epochMsToIsoOrNull(null)).toBe(null);
  });
});
