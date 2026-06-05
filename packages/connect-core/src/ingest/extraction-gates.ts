/**
 * Production extraction warning gates — shift quality left before persist.
 */
import type { ConnectQualityPreset } from "./quality-preset.js";
import type { ExtractionWarning } from "./extract.js";

export type ExtractionGateDecision = {
  allowPersist: boolean;
  reason?: string;
};

/** Decide whether extracted units from a chunk should be persisted. */
export function evaluateExtractionGate(
  warnings: ExtractionWarning[],
  qualityPreset: ConnectQualityPreset,
  schemaMode: "strict" | "guided" | "open",
): ExtractionGateDecision {
  if (qualityPreset !== "production") return { allowPersist: true };

  const noUnits = warnings.some((w) => w.code === "no_units");
  if (noUnits) {
    return { allowPersist: false, reason: "no_units" };
  }

  if (schemaMode === "strict") {
    const pattern = warnings.find((w) => w.code === "pattern_violation" && w.severity === "warning");
    if (pattern && (pattern.count ?? 0) > 0) {
      return {
        allowPersist: true,
        reason: `strict_pattern_violation:${pattern.count}`,
      };
    }
  }

  return { allowPersist: true };
}
