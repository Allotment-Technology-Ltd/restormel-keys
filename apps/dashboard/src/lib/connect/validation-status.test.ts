import { describe, expect, it } from "vitest";
import {
  formatHumanReviewNote,
  isAwaitingHumanTriage,
  isUncheckedValidationStatus,
  matchesGraphRevalidateScope,
  normalizeValidationStatus,
} from "./validation-status";

describe("validation-status", () => {
  it("treats missing and legacy values as unchecked", () => {
    expect(isUncheckedValidationStatus(null)).toBe(true);
    expect(isUncheckedValidationStatus(undefined)).toBe(true);
    expect(isUncheckedValidationStatus("")).toBe(true);
    expect(isUncheckedValidationStatus("unvalidated")).toBe(true);
    expect(isUncheckedValidationStatus("NONE")).toBe(true);
  });

  it("does not treat validated statuses as unchecked", () => {
    expect(isUncheckedValidationStatus("ok")).toBe(false);
    expect(isUncheckedValidationStatus("weak")).toBe(false);
    expect(isUncheckedValidationStatus("unsupported")).toBe(false);
  });

  it("normalizes surreal none sentinels", () => {
    expect(normalizeValidationStatus("NONE")).toBe(null);
    expect(normalizeValidationStatus("ok")).toBe("ok");
  });

  it("detects triage queue vs human-reviewed flagged ideas", () => {
    expect(isAwaitingHumanTriage("weak", "Overstates the source.")).toBe(true);
    expect(isAwaitingHumanTriage("weak", "Human review: weak")).toBe(false);
    expect(isAwaitingHumanTriage("weak", formatHumanReviewNote("weak", null))).toBe(false);
    expect(isAwaitingHumanTriage("ok", null)).toBe(false);
  });

  it("matchesGraphRevalidateScope aligns quarantine with isAwaitingHumanTriage", () => {
    expect(matchesGraphRevalidateScope("weak", "AI note", "quarantine")).toBe(
      isAwaitingHumanTriage("weak", "AI note"),
    );
    expect(matchesGraphRevalidateScope("weak", "Human review: weak", "quarantine")).toBe(false);
  });
});
