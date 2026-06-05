import { describe, expect, it } from "vitest";
import { graphRevalidateEmptyMessage } from "./graph-revalidate-guards";

const statsWithUnits = {
  units: 1200,
  relations: 0,
  groups: 0,
  embedded: 0,
  validation: {
    ok: 0,
    weak: 100,
    unsupported: 438,
    unvalidated: 0,
    awaiting_triage: 538,
    unsupported_untriaged: 483,
  },
};

describe("graphRevalidateEmptyMessage", () => {
  it("allows quarantine auto-remediation when Postgres spine is empty but Surreal stats exist", () => {
    expect(graphRevalidateEmptyMessage(statsWithUnits, "quarantine")).toBeNull();
  });

  it("reports empty graph when stats are missing", () => {
    expect(graphRevalidateEmptyMessage(null, "quarantine")).toBe(
      "Your graph has no ideas to re-validate yet.",
    );
  });

  it("reports empty graph when unit count is zero", () => {
    expect(
      graphRevalidateEmptyMessage(
        { ...statsWithUnits, units: 0, validation: { ...statsWithUnits.validation, awaiting_triage: 0 } },
        "quarantine",
      ),
    ).toBe("Your graph has no ideas to re-validate yet.");
  });

  it("blocks quarantine when triage count is zero but graph has units", () => {
    expect(
      graphRevalidateEmptyMessage(
        {
          ...statsWithUnits,
          validation: { ...statsWithUnits.validation, awaiting_triage: 0, unsupported_untriaged: 0 },
        },
        "quarantine",
      ),
    ).toBe("No quarantined ideas need auto-remediation right now.");
  });
});
