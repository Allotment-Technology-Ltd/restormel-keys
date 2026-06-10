/**
 * Production extraction warning gates — shift quality left before persist.
 *
 * H3 (docs/reviews/connect-ingest-context.md §6): the gate now acts on
 * orphan_units / no_relations / dangling_relation warnings, with thresholds driven by
 * the quality preset (the preset itself is pack-selected via pack.quality_preset) and
 * overridable per call. Production BLOCKS on a breach; starter only WARNS (the breach
 * list is returned so the orchestrator can log it).
 *
 * pattern_violation (strict schema mode): previously this branch returned
 * `allowPersist: true` with a blocking-sounding reason — a contradiction. Resolved
 * deliberately: strict mode is an explicit opt-in contract that relationships conform
 * to the declared patterns, so under the production preset a pattern violation now
 * BLOCKS persist for the chunk. Packs that want lenient persistence use `guided` mode
 * (or the starter preset, which warns instead).
 */
import type { ConnectQualityPreset } from "./quality-preset.js";
import type { ExtractionWarning } from "./extract.js";

export type ExtractionGateThresholds = {
  /** Breaches block persist ("block", production) or only annotate ("warn", starter). */
  mode: "block" | "warn";
  /**
   * Breach when orphan units / total units EXCEEDS this ratio. A `no_relations`
   * warning counts as all units orphaned (ratio 1).
   */
  maxOrphanUnitRatio: number;
  /** Orphan/no_relations gating only applies at or above this unit count (tiny chunks). */
  orphanGateMinUnits: number;
  /** Breach when dangling relations / total relations EXCEEDS this ratio. */
  maxDanglingRelationRatio: number;
};

/** Preset-driven gate thresholds (preset comes from pack.quality_preset — not hardcoded per call site). */
export const EXTRACTION_GATE_THRESHOLDS: Record<ConnectQualityPreset, ExtractionGateThresholds> = {
  production: {
    mode: "block",
    maxOrphanUnitRatio: 0.8,
    orphanGateMinUnits: 3,
    maxDanglingRelationRatio: 0.5,
  },
  starter: {
    mode: "warn",
    maxOrphanUnitRatio: 0.8,
    orphanGateMinUnits: 3,
    maxDanglingRelationRatio: 0.5,
  },
};

export type ExtractionGateDecision = {
  allowPersist: boolean;
  reason?: string;
  /**
   * Threshold breaches found. Populated even when persist is allowed (starter / warn
   * mode) so the orchestrator can log a quality warning for the chunk.
   */
  breaches?: string[];
};

/**
 * Decide whether extracted units from a chunk should be persisted.
 *
 * `opts.totals` (unit/relation counts for the chunk) enables the H3 orphan/dangling
 * ratio gates; without it only count-based checks (no_units, pattern_violation) run —
 * the legacy 3-argument call keeps its original contract.
 */
export function evaluateExtractionGate(
  warnings: ExtractionWarning[],
  qualityPreset: ConnectQualityPreset,
  schemaMode: "strict" | "guided" | "open",
  opts?: {
    totals?: { units: number; relations: number };
    thresholds?: Partial<ExtractionGateThresholds>;
  },
): ExtractionGateDecision {
  const t: ExtractionGateThresholds = {
    ...EXTRACTION_GATE_THRESHOLDS[qualityPreset],
    ...opts?.thresholds,
  };
  const breaches: string[] = [];

  if (warnings.some((w) => w.code === "no_units")) {
    breaches.push("no_units");
  }

  const totals = opts?.totals;
  if (totals && totals.units >= t.orphanGateMinUnits) {
    const orphanCount = warnings.some((w) => w.code === "no_relations")
      ? totals.units
      : (warnings.find((w) => w.code === "orphan_units")?.count ?? 0);
    if (orphanCount / totals.units > t.maxOrphanUnitRatio) {
      breaches.push(`orphan_units:${orphanCount}/${totals.units}`);
    }
  }
  if (totals && totals.relations > 0) {
    const dangling = warnings.find((w) => w.code === "dangling_relation")?.count ?? 0;
    if (dangling / totals.relations > t.maxDanglingRelationRatio) {
      breaches.push(`dangling_relation:${dangling}/${totals.relations}`);
    }
  }

  if (schemaMode === "strict") {
    const pattern = warnings.find((w) => w.code === "pattern_violation" && w.severity === "warning");
    if (pattern && (pattern.count ?? 0) > 0) {
      breaches.push(`pattern_violation:${pattern.count}`);
    }
  }

  if (breaches.length === 0) return { allowPersist: true };
  if (t.mode === "block") {
    return { allowPersist: false, reason: breaches[0]!, breaches };
  }
  return { allowPersist: true, breaches };
}
