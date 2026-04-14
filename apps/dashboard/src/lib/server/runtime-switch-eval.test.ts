import { describe, it, expect } from "vitest";
import {
  classifyUpstreamFailure,
  shouldAdvanceAfterUpstreamFailure,
  hostedSwitchAdvanceMatrix,
} from "$lib/server/runtime-switch-eval";
import type { RouteStepRecord } from "$lib/server/db";

function step(over: Partial<RouteStepRecord> & Pick<RouteStepRecord, "id">): RouteStepRecord {
  return {
    routeId: "r1",
    orderIndex: 0,
    providerPreference: "openai",
    modelId: "gpt-4o",
    conditionBlock: null,
    fallbackOn: "error",
    timeoutMs: null,
    enabled: true,
    createdAt: new Date(1).toISOString(),
    updatedAt: new Date(1).toISOString(),
    ...over,
  } as RouteStepRecord;
}

describe("runtime-switch-eval", () => {
  it("classifies 429 as rate_limit", () => {
    expect(
      classifyUpstreamFailure({
        errorCode: "upstream_http_error",
        httpStatus: 429,
        message: "rate",
      })
    ).toBe("rate_limit");
  });

  it("classifies 500 as error", () => {
    expect(
      classifyUpstreamFailure({
        errorCode: "upstream_http_error",
        httpStatus: 502,
        message: "bad",
      })
    ).toBe("error");
  });

  it("uses fallbackOn any to advance on error", () => {
    const s = step({ id: "a", fallbackOn: "any" });
    expect(shouldAdvanceAfterUpstreamFailure(s, "error")).toBe(true);
    expect(shouldAdvanceAfterUpstreamFailure(s, "rate_limit")).toBe(true);
  });

  it("uses fallbackOn error only for error kind", () => {
    const s = step({ id: "a", fallbackOn: "error" });
    expect(shouldAdvanceAfterUpstreamFailure(s, "error")).toBe(true);
    expect(shouldAdvanceAfterUpstreamFailure(s, "rate_limit")).toBe(false);
  });

  it("honours advanceOn allowlist over fallback", () => {
    const s = step({
      id: "a",
      fallbackOn: "any",
      switchCriteria: { advanceOn: ["rate_limit"] },
    });
    expect(shouldAdvanceAfterUpstreamFailure(s, "rate_limit")).toBe(true);
    expect(shouldAdvanceAfterUpstreamFailure(s, "error")).toBe(false);
  });

  it("ignores non-allowlisted advanceOn strings", () => {
    const s = step({
      id: "a",
      fallbackOn: "error",
      switchCriteria: { advanceOn: ["custom_llm_judge", "error"] },
    });
    expect(shouldAdvanceAfterUpstreamFailure(s, "error")).toBe(true);
  });

  it("hostedSwitchAdvanceMatrix exposes per-kind flags", () => {
    const m = hostedSwitchAdvanceMatrix(step({ id: "x", fallbackOn: "rate_limit" }));
    expect(m.error).toBe(false);
    expect(m.rate_limit).toBe(true);
  });
});
