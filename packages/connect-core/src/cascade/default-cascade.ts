/**
 * Default cascade composition (single selection point — restormel-component-plugpoints
 * "selection is evaluated once at the composition root"). Wires the CLEARED recommended-set
 * tiers behind the four slots:
 *   prefilter          -> HHEM-2.1-Open class (Apache-2.0)      [hhem-prefilter.ts]
 *   excluded_cheap_slot-> permanent stub (candidates excluded)  [excluded-cheap-slot-stub.ts]
 *   mid                -> Granite Guardian 3.3 8B class (Apache) [granite-mid.ts]
 *   escalation         -> frontier API judge                    [frontier-escalation.ts]
 *
 * REMOVABILITY (D-2026-07-02-1): each tier is reached ONLY through this factory + the
 * VerifierTier port. Ripping a tier out = delete its tiers/*.ts file + its line here + its
 * cache entries (purgeByChecker) — the cascade spine (cascade.ts) does not change. See the
 * removal story in the PR description.
 *
 * All tiers here are fixture-backed DOUBLES unless a real `frontierGenerate` is injected;
 * the harness reports honestly which executions were fixture vs live.
 */
import { VerifierCascade, type CascadeConfig } from "./cascade.js";
import { DEV_FIXTURE_CALIBRATION, type CalibrationArtifact } from "./calibration.js";
import { InMemoryVerdictCache, type VerdictCacheStore } from "./verdict-cache.js";
import { createHhemPrefilterDouble } from "./tiers/hhem-prefilter.js";
import { createGraniteMidDouble } from "./tiers/granite-mid.js";
import {
  createFrontierEscalationTier,
  frontierFixtureGenerate,
  type FrontierGenerate,
} from "./tiers/frontier-escalation.js";
import { createExcludedCheapSlotStub } from "./tiers/excluded-cheap-slot-stub.js";

export interface DefaultCascadeOptions {
  cache?: VerdictCacheStore;
  calibration?: CalibrationArtifact;
  /**
   * Injected frontier generate. When absent, the deterministic fixture double is used and
   * the escalation tier's spans are fixture-only (reported as needing a credential).
   */
  frontierGenerate?: FrontierGenerate;
  /** Frontier model family (default "frontier-api-fixture" — independent of the doubles). */
  frontierModelFamily?: string;
  frontierModelVersion?: string;
  authorModelFamily?: string | null;
}

/** True when the default cascade is running the frontier tier on a FIXTURE, not a live API. */
export interface DefaultCascadeBuild {
  cascade: VerifierCascade;
  frontierIsFixture: boolean;
}

export function buildDefaultCascade(opts?: DefaultCascadeOptions): DefaultCascadeBuild {
  const frontierIsFixture = !opts?.frontierGenerate;
  const frontierGenerate = opts?.frontierGenerate ?? frontierFixtureGenerate;
  const config: CascadeConfig = {
    slots: [
      { role: "prefilter", tier: createHhemPrefilterDouble() },
      { role: "excluded_cheap_slot", tier: createExcludedCheapSlotStub() },
      { role: "mid", tier: createGraniteMidDouble() },
      {
        role: "escalation",
        tier: createFrontierEscalationTier({
          generate: frontierGenerate,
          modelFamily: opts?.frontierModelFamily ?? "frontier-api-fixture",
          modelVersion: opts?.frontierModelVersion ?? "double-1",
        }),
      },
    ],
    calibration: opts?.calibration ?? DEV_FIXTURE_CALIBRATION,
    cache: opts?.cache ?? new InMemoryVerdictCache(),
    authorModelFamily: opts?.authorModelFamily ?? null,
  };
  return { cascade: new VerifierCascade(config), frontierIsFixture };
}
