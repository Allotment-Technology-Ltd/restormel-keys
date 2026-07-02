/**
 * RES-113 · component withdrawal / rollback (PR-5, placement spec §5 item 6,
 * decisions D + F; D-2026-07-02-1 rollback posture).
 *
 * The load-bearing guarantees:
 *   1. A withdrawn slot marks `reverted` + carries the withdrawn `withdrawnName`
 *      (the {name} of the one §2.7 notice); the current choice is the recommended
 *      default (reverted server-side).
 *   2. The withdrawn option is ABSENT from that slot's menu thereafter.
 *   3. The notice string is copy-pack §2.7 VERBATIM, with NO "checker" noun and NO
 *      licence / counsel / at-risk language (decision D; D-2026-07-02-1).
 *   4. Only the affected slot changes — zero cross-slot delta.
 */
import { describe, it, expect } from "vitest";
import {
  parseWithdrawnSlots,
  pipelineWithdrawalNotice,
  resolveM1PipelineSlots,
} from "./pipeline-config";

// A real CLEARED validate option (only cleared options are ever selectable, so a
// withdrawn name is always a cleared display name — BLOCKED/AMBIGUOUS never enter).
const WITHDRAWN_VALIDATE = "Frontier hosted model (Claude, Gemini, or GPT)";

describe("resolveM1PipelineSlots — withdrawal input (PR-5)", () => {
  it("marks the reverted slot + carries the withdrawn name, current = recommended default", () => {
    const rows = resolveM1PipelineSlots({ withdrawn_slots: { validate: WITHDRAWN_VALIDATE } });
    const bySlot = Object.fromEntries(rows.map((r) => [r.slot, r]));
    expect(bySlot.validate.reverted).toBe(true);
    expect(bySlot.validate.withdrawnName).toBe(WITHDRAWN_VALIDATE);
    // Reverted server-side to the recommended default.
    expect(bySlot.validate.currentName).toBe("Granite Guardian");
    expect(bySlot.validate.isDefault).toBe(true);
    // Zero cross-slot delta: the other two slots are untouched.
    expect(bySlot.extract.reverted).toBeUndefined();
    expect(bySlot.extract.withdrawnName).toBeUndefined();
    expect(bySlot.embed.reverted).toBeUndefined();
  });

  it("drops the withdrawn option from that slot's menu (absent thereafter)", () => {
    const rows = resolveM1PipelineSlots({ withdrawn_slots: { validate: WITHDRAWN_VALIDATE } });
    const validate = rows.find((r) => r.slot === "validate")!;
    expect(validate.options.some((o) => o.name === WITHDRAWN_VALIDATE)).toBe(false);
    // The rest of the CLEARED menu survives.
    expect(validate.options.map((o) => o.name)).toEqual(["Granite Guardian", "HHEM-2.1-Open"]);
    // Other slots keep full menus.
    expect(rows.find((r) => r.slot === "extract")!.options).toHaveLength(3);
  });

  it("the legacy reverted_slots signal still marks reverted (no notice without a name)", () => {
    const rows = resolveM1PipelineSlots({ reverted_slots: ["embed"] });
    const embed = rows.find((r) => r.slot === "embed")!;
    expect(embed.reverted).toBe(true);
    expect(embed.withdrawnName).toBeUndefined();
  });
});

describe("pipelineWithdrawalNotice — copy pack §2.7 verbatim (decision F)", () => {
  it("renders the single converged string with {stage}/{name}", () => {
    expect(pipelineWithdrawalNotice("Checking against sources", WITHDRAWN_VALIDATE)).toBe(
      "Frontier hosted model (Claude, Gemini, or GPT) is no longer available — Checking against sources is back on the recommended default. Your graph and answers are unaffected.",
    );
  });

  it("never uses the 'checker' noun, nor licence / counsel / at-risk language", () => {
    const s = pipelineWithdrawalNotice("Checking against sources", WITHDRAWN_VALIDATE).toLowerCase();
    for (const banned of ["checker", "licence", "license", "counsel", "at-risk", "at risk", "blocked", "ambiguous"]) {
      expect(s).not.toContain(banned);
    }
  });
});

describe("parseWithdrawnSlots", () => {
  it("keeps valid slot → non-empty string, drops junk", () => {
    expect(parseWithdrawnSlots({ validate: "X", store: "Y", embed: "" })).toEqual({ validate: "X" });
    expect(parseWithdrawnSlots(null)).toEqual({});
    expect(parseWithdrawnSlots(["validate"])).toEqual({});
    expect(parseWithdrawnSlots("nope")).toEqual({});
  });
});
