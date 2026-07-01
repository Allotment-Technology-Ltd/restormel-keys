import { describe, expect, it } from "vitest";
import type { ConnectIngestStageProgress } from "@restormel/connect-core";
import {
  modelStageToPipelineStage,
  buildStageBackoffState,
  setStageBackoff,
  clearStageBackoff,
  hasActiveStageBackoff,
} from "./ingest-backoff";

describe("modelStageToPipelineStage", () => {
  it("maps each model stage to its pipeline row", () => {
    expect(modelStageToPipelineStage("extraction")).toBe("extracting");
    expect(modelStageToPipelineStage("grouping")).toBe("grouping");
    expect(modelStageToPipelineStage("validation")).toBe("validating");
    expect(modelStageToPipelineStage("remediation")).toBe("remediating");
    expect(modelStageToPipelineStage("embedding")).toBe("embedding");
  });

  it("returns null for an unknown stage", () => {
    expect(modelStageToPipelineStage("storing")).toBeNull();
    expect(modelStageToPipelineStage("nonsense")).toBeNull();
  });
});

describe("buildStageBackoffState", () => {
  it("projects a valid input", () => {
    expect(
      buildStageBackoffState({ reasonCode: "rate_limit", attempt: 2, delayMs: 2000, at: "t" }),
    ).toEqual({ reason_code: "rate_limit", attempt: 2, delay_ms: 2000, at: "t" });
  });

  it("rejects an unknown reason code (never persists junk)", () => {
    expect(buildStageBackoffState({ reasonCode: "bogus", attempt: 1, delayMs: 0 })).toBeNull();
  });

  it("defaults a missing timestamp + coerces bad numerics", () => {
    const out = buildStageBackoffState({ reasonCode: "overloaded", attempt: 0, delayMs: -1 });
    expect(out).toMatchObject({ reason_code: "overloaded", attempt: 1, delay_ms: 0 });
    expect(typeof out!.at).toBe("string");
  });
});

function rows(): ConnectIngestStageProgress[] {
  return [
    { stage: "extracting", status: "running" },
    { stage: "validating", status: "pending" },
  ];
}

describe("setStageBackoff / clearStageBackoff", () => {
  const backoff = { reason_code: "rate_limit" as const, attempt: 1, delay_ms: 1000, at: "t" };

  it("sets backoff on the target stage only, without mutating the input", () => {
    const input = rows();
    const out = setStageBackoff(input, "extracting", backoff);
    expect(out.find((r) => r.stage === "extracting")?.backoff).toEqual(backoff);
    expect(out.find((r) => r.stage === "validating")?.backoff).toBeUndefined();
    // No mutation.
    expect(input.find((r) => r.stage === "extracting")?.backoff).toBeUndefined();
  });

  it("clears one stage", () => {
    const withBackoff = setStageBackoff(rows(), "extracting", backoff);
    const cleared = clearStageBackoff(withBackoff, "extracting");
    expect(hasActiveStageBackoff(cleared)).toBe(false);
  });

  it("clears all stages when no target is given", () => {
    let r = setStageBackoff(rows(), "extracting", backoff);
    r = setStageBackoff(r, "validating", backoff);
    expect(hasActiveStageBackoff(r)).toBe(true);
    expect(hasActiveStageBackoff(clearStageBackoff(r))).toBe(false);
  });

  it("clear is a no-op shape when there is nothing to clear", () => {
    const input = rows();
    expect(hasActiveStageBackoff(clearStageBackoff(input))).toBe(false);
  });
});
