import { describe, expect, it } from "vitest";
import {
  ingestStatusLabel,
  trustScoreDescriptor,
  unitsSupportedDescriptor,
} from "./ingest-quality-display";

describe("trustScoreDescriptor", () => {
  it("labels moderate scores", () => {
    expect(trustScoreDescriptor(75).full).toBe("75 — Moderate");
  });

  it("labels low scores as needs attention", () => {
    expect(trustScoreDescriptor(42).label).toBe("Needs attention");
  });
});

describe("unitsSupportedDescriptor", () => {
  it("labels below-average coverage", () => {
    expect(unitsSupportedDescriptor(43).full).toContain("below average");
  });
});

describe("ingestStatusLabel", () => {
  it("uses sentence case", () => {
    expect(ingestStatusLabel("completed")).toBe("Completed");
    expect(ingestStatusLabel("running")).toBe("In progress");
  });
});
