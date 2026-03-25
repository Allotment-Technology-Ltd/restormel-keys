import { describe, it, expect } from "vitest";
import {
  buildExternalSignalsFreshness,
  OPENROUTER_ENDPOINT_HEALTH_MAX_AGE_MS,
  freshnessGuard,
} from "./catalog-external-signals";

describe("buildExternalSignalsFreshness", () => {
  it("marks allFresh when samples are within SLO age", () => {
    const now = Date.UTC(2026, 2, 25, 12, 0, 0);
    const recent = new Date(now - 60_000).toISOString();
    const f = buildExternalSignalsFreshness({
      openRouterModelsFetchedAt: recent,
      openaiFetchedAt: recent,
      anthropicFetchedAt: recent,
      endpointHealthByModel: {
        "m/a": {
          providerModelId: "m/a",
          fetchedAt: recent,
          endpointCount: 1,
          statuses: ["ok"],
          uptimeLast30m: 99,
          latencyLast30m: null,
          throughputLast30m: null,
        },
      },
      nowMs: now,
    });
    expect(f.allFresh).toBe(true);
    expect(f.openRouterEndpointHealth.isFresh).toBe(true);
    expect(f.openRouterEndpointHealth.staleModelIds).toBeUndefined();
  });

  it("marks endpoint health stale when a per-model sample exceeds threshold", () => {
    const now = Date.UTC(2026, 2, 25, 12, 0, 0);
    const recent = new Date(now - 60_000).toISOString();
    const old = new Date(now - OPENROUTER_ENDPOINT_HEALTH_MAX_AGE_MS - 1).toISOString();
    const f = buildExternalSignalsFreshness({
      openRouterModelsFetchedAt: recent,
      openaiFetchedAt: recent,
      anthropicFetchedAt: recent,
      endpointHealthByModel: {
        "x/y": {
          providerModelId: "x/y",
          fetchedAt: old,
          endpointCount: 0,
          statuses: [],
          uptimeLast30m: null,
          latencyLast30m: null,
          throughputLast30m: null,
        },
      },
      nowMs: now,
    });
    expect(f.allFresh).toBe(false);
    expect(f.openRouterEndpointHealth.isFresh).toBe(false);
    expect(f.openRouterEndpointHealth.staleModelIds).toEqual(["x/y"]);
  });
});

describe("freshnessGuard", () => {
  it("returns isFresh false when age exceeds maxAgeMs", () => {
    const now = 1_000_000;
    const fetched = new Date(now - 120_000).toISOString();
    const g = freshnessGuard(fetched, 60_000, now);
    expect(g.isFresh).toBe(false);
    expect(g.ageMs).toBe(120_000);
  });
});
