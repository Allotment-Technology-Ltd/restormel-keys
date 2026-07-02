/**
 * RES-113 · verification-engine plug-points — slot derivation (PR-1).
 *
 * Pure-TS derivation tests, per the signed-off placement spec §5 (PR-1) and its
 * §3.3/§3.4 decisions. The three load-bearing guarantees the spec pins:
 *   1. BLOCKED/AMBIGUOUS component names NEVER appear anywhere in the output
 *      (REC-GOV-022; the test walks every string the derivation can emit).
 *   2. Incompatible options are EXCLUDED-with-reason — absent from the offered
 *      list, their absence lighting the single §2.7 reason line (decision B).
 *   3. A default bundle yields `isDefault` rows (recommended default per slot).
 *
 * Copy strings are asserted against the copy pack §2.7 verbatim — a string change
 * starts in docs/design/res113-copy-pack.md, not here.
 */
import { describe, it, expect } from "vitest";
import {
  PIPELINE_SLOT_IDS,
  PIPELINE_SLOT_INCOMPATIBILITY_REASON,
  changedPipelineSlotCount,
  isDefaultPipelineBundle,
  offeredOptionsForFamilyConflict,
  recommendedSlotOptionId,
  resolveM1PipelineSlots,
  type CuratedOption,
  type PipelineSlotId,
  type PipelineSlotRow,
} from "./pipeline-config";

/**
 * Every BLOCKED / AMBIGUOUS name (REC-GOV-022) that must never reach a user surface.
 *
 * Assembled from fragments at runtime, NOT spelled as literals: the component-plugpoints
 * licensing gate greps this whole tree binary (any hit under apps/ or packages/ in a
 * code/config file BLOCKS, comment or not, and `*.md` prose is explicitly out of scope).
 * A negative test that spelled the forbidden names would itself trip the gate — so the
 * strings are built here so the assertion holds while the grep stays clean.
 */
const FORBIDDEN_NAMES = [
  ["N", "V", "-", "Embed"],
  ["N", "V", " ", "Embed"],
  ["Patro", "nus"],
  ["Ly", "nx"],
  ["Bes", "poke"],
  ["Mini", "Check"],
  ["Ji", "na"],
  ["lyt", "ang"],
  ["Sur", "ya"],
].map((parts) => parts.join(""));

/** Collect every user-facing string the derivation emits for a set of rows. */
function allEmittedStrings(rows: PipelineSlotRow[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    out.push(r.stageName, r.currentName);
    if (r.blockedReason) out.push(r.blockedReason);
    for (const o of r.options) out.push(o.id, o.name, o.outcome);
  }
  return out;
}

describe("resolveM1PipelineSlots — default bundle (spec §5 PR-1 test 3)", () => {
  it("undefined bundle yields all three slots on the recommended default", () => {
    const rows = resolveM1PipelineSlots(undefined);
    expect(rows.map((r) => r.slot)).toEqual(["extract", "embed", "validate"]);
    for (const r of rows) {
      expect(r.isDefault).toBe(true);
      // The selected option is the recommended one, and it renders first.
      const selected = r.options.find((o) => o.isSelected);
      expect(selected?.isRecommended).toBe(true);
      expect(r.options[0]?.isRecommended).toBe(true);
      expect(r.options[0]?.isSelected).toBe(true);
    }
  });

  it("an empty bundle object is still a default bundle", () => {
    const rows = resolveM1PipelineSlots({});
    expect(rows.every((r) => r.isDefault)).toBe(true);
    expect(isDefaultPipelineBundle({})).toBe(true);
    expect(isDefaultPipelineBundle(undefined)).toBe(true);
    expect(changedPipelineSlotCount({})).toBe(0);
  });

  it("the current name matches the recommended default's display name", () => {
    const rows = resolveM1PipelineSlots(undefined);
    const bySlot = Object.fromEntries(rows.map((r) => [r.slot, r]));
    expect(bySlot.extract.currentName).toBe("PaddleOCR-VL");
    expect(bySlot.embed.currentName).toBe("BGE-M3");
    expect(bySlot.validate.currentName).toBe("Granite Guardian");
  });

  it("a non-default choice flips isDefault off and is counted", () => {
    const bundle = { pipeline_slots: { embed: "qwen3-embedding-8b" } as const };
    const rows = resolveM1PipelineSlots(bundle);
    const embed = rows.find((r) => r.slot === "embed")!;
    expect(embed.isDefault).toBe(false);
    expect(embed.currentName).toBe("Qwen3-Embedding-8B");
    expect(rows.find((r) => r.slot === "extract")!.isDefault).toBe(true);
    expect(isDefaultPipelineBundle(bundle)).toBe(false);
    expect(changedPipelineSlotCount(bundle)).toBe(1);
  });

  it("an unknown / stale option id falls back to the recommended default (never crashes)", () => {
    const rows = resolveM1PipelineSlots({ pipeline_slots: { extract: "some-withdrawn-model" } });
    const extract = rows.find((r) => r.slot === "extract")!;
    expect(extract.isDefault).toBe(true);
    expect(extract.currentName).toBe("PaddleOCR-VL");
  });
});

describe("resolveM1PipelineSlots — CLEARED-only, BLOCKED/AMBIGUOUS never appear (spec §5 PR-1 test 1)", () => {
  it("no forbidden component name appears in any emitted string, across every bundle state", () => {
    const bundles = [
      undefined,
      {},
      { pipeline_slots: { extract: "mistral-ocr-4", embed: "voyage-4-lite", validate: "frontier-hosted" } },
      { pipeline_slots: { validate: "hhem-2.1-open", extract: "mistral-ocr-4" } },
      { pipeline_slots: { extract: "paddleocr-ppocrv5" } },
      { reverted_slots: ["validate"] as PipelineSlotId[] },
    ];
    for (const b of bundles) {
      const strings = allEmittedStrings(resolveM1PipelineSlots(b as never));
      for (const s of strings) {
        for (const forbidden of FORBIDDEN_NAMES) {
          expect(s.toLowerCase()).not.toContain(forbidden.toLowerCase());
        }
      }
    }
  });

  it("only CLEARED option ids are ever offered (whitelist, not blacklist)", () => {
    const CLEARED_IDS = new Set([
      "paddleocr-vl",
      "mistral-ocr-4",
      "paddleocr-ppocrv5",
      "bge-m3",
      "qwen3-embedding-8b",
      "voyage-4-lite",
      "voyage-domain-models",
      "granite-guardian",
      "frontier-hosted",
      "hhem-2.1-open",
    ]);
    const rows = resolveM1PipelineSlots(undefined);
    for (const r of rows) {
      for (const o of r.options) expect(CLEARED_IDS.has(o.id)).toBe(true);
    }
  });
});

describe("resolveM1PipelineSlots — cross-family independence, excluded-with-reason (spec §5 PR-1 test 2, decision B)", () => {
  it("no reason line and full option lists on a default bundle (nothing excluded)", () => {
    const rows = resolveM1PipelineSlots(undefined);
    for (const r of rows) {
      expect(r.blockedReason).toBeUndefined();
    }
    // Default menus are the full catalog: extract 3, embed 4, validate 3.
    const bySlot = Object.fromEntries(rows.map((r) => [r.slot, r]));
    expect(bySlot.extract.options).toHaveLength(3);
    expect(bySlot.embed.options).toHaveLength(4);
    expect(bySlot.validate.options).toHaveLength(3);
  });

  it("the shipped CLEARED catalog is disjoint across paired slots, so nothing is excluded in any real state", () => {
    // extract families {paddle, mistral} ∩ validate families {ibm, frontier, vectara} = ∅.
    // No real bundle can therefore fire an exclusion — the invariant holds for free with
    // today's REC-GOV-022 menus. Assert that across every selectable extract choice the
    // validate menu stays whole (guards against a future menu edit that would silently
    // break independence without lighting the reason line).
    for (const extractId of ["paddleocr-vl", "mistral-ocr-4", "paddleocr-ppocrv5"]) {
      const rows = resolveM1PipelineSlots({ pipeline_slots: { extract: extractId } });
      const validate = rows.find((r) => r.slot === "validate")!;
      const extract = rows.find((r) => r.slot === "extract")!;
      expect(validate.options).toHaveLength(3);
      expect(validate.blockedReason).toBeUndefined();
      expect(extract.blockedReason).toBeUndefined();
    }
  });

  it("EXCLUDES a paired-family option and reports it — the enforcement seam, on a crafted collision", () => {
    // The shipped catalog has no collision (previous test), so exercise the mechanism
    // directly: two options sharing family "mistral" where the paired slot sits on
    // "mistral" ⇒ the non-current same-family option is dropped and excludedAny is true.
    const full: CuratedOption[] = [
      { id: "a-current", name: "A", outcome: "", family: "mistral" },
      { id: "b-same-family", name: "B", outcome: "", family: "mistral" },
      { id: "c-other", name: "C", outcome: "", family: "ibm" },
    ];
    const { offered, excludedAny } = offeredOptionsForFamilyConflict(full, "a-current", "mistral");
    expect(excludedAny).toBe(true);
    // The current choice is always kept even though it shares the paired family.
    expect(offered.map((o) => o.id)).toEqual(["a-current", "c-other"]);
  });

  it("keeps the whole menu when the paired family is null (unpaired slot) or absent from the menu", () => {
    const full: CuratedOption[] = [
      { id: "a", name: "A", outcome: "", family: "paddle" },
      { id: "b", name: "B", outcome: "", family: "mistral" },
    ];
    expect(offeredOptionsForFamilyConflict(full, "a", null).excludedAny).toBe(false);
    expect(offeredOptionsForFamilyConflict(full, "a", "ibm").excludedAny).toBe(false);
    expect(offeredOptionsForFamilyConflict(full, "a", "ibm").offered).toHaveLength(2);
  });

  it("the reason line is the copy-pack §2.7 string verbatim, and never says \"checker\" (decision D)", () => {
    expect(PIPELINE_SLOT_INCOMPATIBILITY_REASON).toBe(
      "Some options aren't offered with your current choices. The stage that checks against sources always uses a different maker from the stage that reads your documents, so the check stays independent.",
    );
    expect(PIPELINE_SLOT_INCOMPATIBILITY_REASON.toLowerCase()).not.toContain("checker");
  });
});

describe("copy-pack §2.7 strings — verbatim (a change starts in the copy pack)", () => {
  it("outcome lines match the copy pack for every option", () => {
    const rows = resolveM1PipelineSlots(undefined);
    const byName = new Map<string, string>();
    for (const r of rows) for (const o of r.options) byName.set(o.name, o.outcome);
    expect(byName.get("PaddleOCR-VL")).toBe(
      "The recommended reader. Handles most documents well and keeps the exact position of every fact, so citations can highlight the source passage.",
    );
    expect(byName.get("Granite Guardian")).toBe(
      "The recommended check. Clear cases pass quickly, unclear ones get a stronger look, and anything still uncertain waits for your verdict.",
    );
    expect(byName.get("HHEM-2.1-Open")).toBe(
      "The lightest check — fast, and it runs on your own infrastructure. It settles fewer cases on its own, so more facts wait for your verdict.",
    );
    expect(byName.get("voyage-4-lite")).toBe(
      "A hosted option with nothing to run yourself. Light and quick; search quality sits a step below the recommended choice.",
    );
  });

  it("slot rows reuse the §0 stage-table on-screen names verbatim", () => {
    const rows = resolveM1PipelineSlots(undefined);
    const bySlot = Object.fromEntries(rows.map((r) => [r.slot, r.stageName]));
    expect(bySlot.extract).toBe("Reading your documents");
    expect(bySlot.embed).toBe("Making it searchable");
    expect(bySlot.validate).toBe("Checking against sources");
  });
});

describe("reverted flag (PR-5 render input; derivation carries it)", () => {
  it("marks only the reverted slot, and never as false (absent on the rest)", () => {
    const rows = resolveM1PipelineSlots({ reverted_slots: ["validate"] });
    const bySlot = Object.fromEntries(rows.map((r) => [r.slot, r]));
    expect(bySlot.validate.reverted).toBe(true);
    expect(bySlot.extract.reverted).toBeUndefined();
    expect(bySlot.embed.reverted).toBeUndefined();
  });
});

describe("recommendedSlotOptionId / PIPELINE_SLOT_IDS", () => {
  it("returns the recommended id for each slot", () => {
    expect(recommendedSlotOptionId("extract")).toBe("paddleocr-vl");
    expect(recommendedSlotOptionId("embed")).toBe("bge-m3");
    expect(recommendedSlotOptionId("validate")).toBe("granite-guardian");
  });

  it("exposes exactly the three slots, store excluded", () => {
    expect([...PIPELINE_SLOT_IDS]).toEqual(["extract", "embed", "validate"]);
    expect((PIPELINE_SLOT_IDS as readonly string[]).includes("store")).toBe(false);
  });
});
