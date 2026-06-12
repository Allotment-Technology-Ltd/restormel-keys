import { describe, it, expect } from "vitest";
import { isMobileAllowedPath } from "./dashboard-mobile-tier";
import { HOME_HREF, RUNS_HREF, CLAIMS_HREF, SOURCES_HREF } from "$lib/nav-config";

describe("isMobileAllowedPath", () => {
  it("opens Home", () => {
    expect(isMobileAllowedPath(HOME_HREF)).toBe(true);
  });
  it("opens Claims and its sub-routes", () => {
    expect(isMobileAllowedPath(CLAIMS_HREF)).toBe(true);
    expect(isMobileAllowedPath(CLAIMS_HREF + "/memory")).toBe(true);
  });
  it("opens an individual run console but NOT the runs list", () => {
    expect(isMobileAllowedPath(RUNS_HREF + "/abc-123")).toBe(true);
    expect(isMobileAllowedPath(RUNS_HREF)).toBe(false);
  });
  it("keeps the gate on everything else", () => {
    expect(isMobileAllowedPath(SOURCES_HREF)).toBe(false);
    expect(isMobileAllowedPath(SOURCES_HREF + "/ingest")).toBe(false);
    expect(isMobileAllowedPath("/keys/dashboard/routes/ingestion")).toBe(false);
  });
});
