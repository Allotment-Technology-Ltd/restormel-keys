import { afterEach, describe, expect, it } from "vitest";
import {
  mergeRouteResolveFailure,
  routeRetryDeadlineExceeded,
  routeRetryDeadlineMs,
} from "./stage-route-generate";

describe("mergeRouteResolveFailure", () => {
  it("preserves upstream error when resolver exhausts fallback on retry", () => {
    const upstream = new Error("context length exceeded");
    const err = mergeRouteResolveFailure(upstream, 1, {
      code: "no_key_available",
      message: "No further steps to try after previous failure context",
    });
    expect(err.message).toContain("context length exceeded");
    expect(err.message).toContain("Route fallback exhausted after");
    expect(err.message).not.toBe("No further steps to try after previous failure context");
  });

  it("uses resolver message on first attempt failure", () => {
    const err = mergeRouteResolveFailure(undefined, 0, {
      code: "no_key_available",
      message: "No enabled route step available",
    });
    expect(err.message).toBe("No enabled route step available");
  });

  it("uses resolver message on retry when no prior upstream error", () => {
    const err = mergeRouteResolveFailure(undefined, 2, {
      code: "no_key_available",
      message: "No further steps to try after previous failure context",
    });
    expect(err.message).toBe("No further steps to try after previous failure context");
  });
});

describe("route retry wall-clock deadline", () => {
  afterEach(() => {
    delete process.env.CONNECT_ROUTE_RETRY_DEADLINE_MS;
  });

  it("defaults to 15 minutes and honors env override", () => {
    expect(routeRetryDeadlineMs()).toBe(15 * 60_000);
    process.env.CONNECT_ROUTE_RETRY_DEADLINE_MS = "60000";
    expect(routeRetryDeadlineMs()).toBe(60_000);
    process.env.CONNECT_ROUTE_RETRY_DEADLINE_MS = "junk";
    expect(routeRetryDeadlineMs()).toBe(15 * 60_000);
  });

  it("flags expiry only after the deadline elapses", () => {
    process.env.CONNECT_ROUTE_RETRY_DEADLINE_MS = "10000";
    const start = 1_000_000;
    expect(routeRetryDeadlineExceeded(start, start + 9_999)).toBe(false);
    expect(routeRetryDeadlineExceeded(start, start + 10_000)).toBe(true);
    expect(routeRetryDeadlineExceeded(start, start + 60_000)).toBe(true);
  });
});
