import { describe, expect, it } from "vitest";
import { matchesGraphRevalidateScope } from "$lib/connect/validation-status";
import { matchesRevalidateUnitScope } from "./graph-revalidate-service";
import { surrealRevalidateUnitsQuery } from "./surreal-graph-units-load";

describe("graph revalidate scope", () => {
  it("quarantine matches weak/unsupported without human review note", () => {
    expect(matchesGraphRevalidateScope("weak", "Overstates source.", "quarantine")).toBe(true);
    expect(matchesGraphRevalidateScope("unsupported", null, "quarantine")).toBe(true);
    expect(matchesGraphRevalidateScope("weak", "Human review: weak", "quarantine")).toBe(false);
  });

  it("unsupported scope matches only unreviewed unsupported", () => {
    expect(matchesGraphRevalidateScope("unsupported", "No basis.", "unsupported")).toBe(true);
    expect(matchesGraphRevalidateScope("unsupported", "Human review: unsupported", "unsupported")).toBe(
      false,
    );
  });

  it("matchesRevalidateUnitScope delegates via unit shape", () => {
    expect(
      matchesRevalidateUnitScope(
        { id: "u1", text: "t", validationStatus: "weak", validationNote: null },
        "quarantine",
      ),
    ).toBe(true);
  });

  it("surreal revalidate query includes validation_note", () => {
    const sql = surrealRevalidateUnitsQuery("unit", 200, 0, true);
    expect(sql).toContain("validation_note");
  });
});
