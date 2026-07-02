/**
 * RES-113 · deployment presets — derivation (PR-3, placement spec §5 item 4,
 * decision A).
 *
 * The load-bearing guarantees:
 *   1. Every preset keeps REC-ADR-023 invariant 1 (extract family ≠ validate
 *      family) and draws ONLY from the CLEARED slot catalog.
 *   2. "Fully managed (recommended)" IS the recommended-default bundle.
 *   3. Applying a preset annotates each matching slot "Part of {preset}." (copy
 *      pack §2.7); a preset → custom (one slot) → preset swap round-trips through
 *      the PR-1 derivation, the annotation following the current choice each time.
 *   4. `presetSlotChangeCount` is the honest {n} for the confirm ("swaps {n} stages").
 */
import { describe, it, expect } from "vitest";
import {
  PIPELINE_PRESET_IDS,
  PIPELINE_PRESETS,
  PIPELINE_SLOT_IDS,
  appliedPresetName,
  isPipelinePresetId,
  parsePipelinePreset,
  presetSlotAssignments,
  presetSlotChangeCount,
  recommendedSlotOptionId,
  resolveM1PipelineSlots,
  type PipelinePresetId,
} from "./pipeline-config";

/** Family lookup mirrors the derivation's own SLOT_CATALOG (not exported) via a row probe. */
function familyDisjoint(presetId: PipelinePresetId): boolean {
  // Apply the preset to a bundle, derive rows: no blockedReason ⇒ no cross-family clash.
  const slots = presetSlotAssignments(presetId);
  const rows = resolveM1PipelineSlots({ pipeline_slots: slots });
  return rows.every((r) => r.blockedReason === undefined);
}

describe("PIPELINE_PRESETS — cleared, invariant-safe bundles", () => {
  it("exposes exactly the four copy-pack §2.7 presets, names verbatim", () => {
    expect([...PIPELINE_PRESET_IDS]).toEqual([
      "fully-managed",
      "highest-accuracy",
      "regional-residency",
      "self-host-air-gapped",
    ]);
    expect(PIPELINE_PRESETS["fully-managed"].name).toBe("Fully managed (recommended)");
    expect(PIPELINE_PRESETS["highest-accuracy"].name).toBe("Highest accuracy");
    expect(PIPELINE_PRESETS["regional-residency"].name).toBe("Regional residency");
    expect(PIPELINE_PRESETS["self-host-air-gapped"].name).toBe("Self-host air-gapped");
  });

  it("every preset draws only from the CLEARED catalog and keeps cross-family independence", () => {
    const CLEARED = new Set([
      "paddleocr-vl", "mistral-ocr-4", "paddleocr-ppocrv5",
      "bge-m3", "qwen3-embedding-8b", "voyage-4-lite", "voyage-domain-models",
      "granite-guardian", "frontier-hosted", "hhem-2.1-open",
    ]);
    for (const id of PIPELINE_PRESET_IDS) {
      for (const slot of PIPELINE_SLOT_IDS) {
        expect(CLEARED.has(PIPELINE_PRESETS[id].slots[slot])).toBe(true);
      }
      // Invariant 1 (REC-ADR-023): no cross-family clash ⇒ no reason line.
      expect(familyDisjoint(id)).toBe(true);
    }
  });

  it("'Fully managed (recommended)' IS the recommended-default bundle", () => {
    for (const slot of PIPELINE_SLOT_IDS) {
      expect(PIPELINE_PRESETS["fully-managed"].slots[slot]).toBe(recommendedSlotOptionId(slot));
    }
    // ⇒ writes an empty slot map (a real default bundle).
    expect(presetSlotAssignments("fully-managed")).toEqual({});
  });

  it("presetSlotAssignments omits slots already on their default", () => {
    // regional-residency = mistral-ocr-4 (non-default) + bge-m3 + granite-guardian (defaults).
    expect(presetSlotAssignments("regional-residency")).toEqual({ extract: "mistral-ocr-4" });
    expect(presetSlotAssignments("highest-accuracy")).toEqual({
      extract: "mistral-ocr-4",
      embed: "qwen3-embedding-8b",
      validate: "frontier-hosted",
    });
  });
});

describe("parse / helpers", () => {
  it("isPipelinePresetId + parsePipelinePreset accept only known ids", () => {
    expect(isPipelinePresetId("highest-accuracy")).toBe(true);
    expect(isPipelinePresetId("nope")).toBe(false);
    expect(parsePipelinePreset("self-host-air-gapped")).toBe("self-host-air-gapped");
    expect(parsePipelinePreset("nope")).toBeNull();
    expect(parsePipelinePreset(7)).toBeNull();
  });

  it("appliedPresetName reads the marker, ignoring an unknown one", () => {
    expect(appliedPresetName({ pipeline_preset: "highest-accuracy" })).toBe("Highest accuracy");
    expect(appliedPresetName({ pipeline_preset: "stale" })).toBeNull();
    expect(appliedPresetName(undefined)).toBeNull();
  });

  it("presetSlotChangeCount is the honest {n} of changed stages from current", () => {
    // From a default bundle: highest-accuracy changes all 3; regional changes 1 (extract).
    expect(presetSlotChangeCount(undefined, "highest-accuracy")).toBe(3);
    expect(presetSlotChangeCount(undefined, "regional-residency")).toBe(1);
    expect(presetSlotChangeCount(undefined, "fully-managed")).toBe(0);
  });
});

describe("Part of {preset}. annotation + round-trip (spec §5 PR-3)", () => {
  function bundleForPreset(id: PipelinePresetId) {
    return { pipeline_preset: id, pipeline_slots: presetSlotAssignments(id) };
  }

  it("applying a preset annotates every matching slot with its display name", () => {
    const rows = resolveM1PipelineSlots(bundleForPreset("highest-accuracy"));
    for (const r of rows) expect(r.partOfPreset).toBe("Highest accuracy");
  });

  it("'Fully managed (recommended)' annotates a default bundle when explicitly applied", () => {
    const rows = resolveM1PipelineSlots({ pipeline_preset: "fully-managed" });
    for (const r of rows) {
      expect(r.partOfPreset).toBe("Fully managed (recommended)");
      expect(r.isDefault).toBe(true);
    }
    // A fresh default bundle with NO preset marker annotates nothing (novice honesty).
    for (const r of resolveM1PipelineSlots(undefined)) expect(r.partOfPreset).toBeUndefined();
  });

  it("preset → custom (one slot) → preset round-trips, annotation follows the current choice", () => {
    // 1. Apply highest-accuracy: all slots annotated.
    let bundle = bundleForPreset("highest-accuracy");
    let rows = resolveM1PipelineSlots(bundle);
    expect(rows.every((r) => r.partOfPreset === "Highest accuracy")).toBe(true);

    // 2. Customise embed away from the preset (to the recommended default).
    bundle = {
      pipeline_preset: "highest-accuracy",
      pipeline_slots: { extract: "mistral-ocr-4", validate: "frontier-hosted" },
    };
    rows = resolveM1PipelineSlots(bundle);
    const bySlot = Object.fromEntries(rows.map((r) => [r.slot, r]));
    expect(bySlot.extract.partOfPreset).toBe("Highest accuracy");
    expect(bySlot.validate.partOfPreset).toBe("Highest accuracy");
    // embed no longer comes from the preset ⇒ annotation absent.
    expect(bySlot.embed.partOfPreset).toBeUndefined();

    // 3. Re-apply the preset: all slots annotated again (round-trip complete).
    rows = resolveM1PipelineSlots(bundleForPreset("highest-accuracy"));
    expect(rows.every((r) => r.partOfPreset === "Highest accuracy")).toBe(true);
  });
});
