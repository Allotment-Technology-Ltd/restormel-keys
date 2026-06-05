/**
 * Ingest quality presets — production is the default for new packs/runs.
 * Starter is an explicit opt-down for demos (lower chunk cap; same stage order).
 */
import type { ConnectDomainPack, ConnectIngestStage } from "@restormel/contracts/connect";

export type ConnectQualityPreset = "production" | "starter";

export const CONNECT_QUALITY_PRESET_DEFAULT: ConnectQualityPreset = "production";

export type ConnectQualityPresetConfig = {
  preset: ConnectQualityPreset;
  /** Max chunks per job (env override still capped by hard max). */
  maxChunks: number;
  /** Hard ceiling for maxChunks. */
  maxChunksCeiling: number;
  /** Production always runs through remediate unless stop_after is earlier. */
  minStopAfterStage: ConnectIngestStage | null;
  requirePreviewOnPackChange: boolean;
  /** Warn when validation route would match extraction (cross-model). */
  requireCrossModelValidation: boolean;
};

const STARTER: ConnectQualityPresetConfig = {
  preset: "starter",
  maxChunks: 8,
  maxChunksCeiling: 24,
  minStopAfterStage: null,
  requirePreviewOnPackChange: false,
  requireCrossModelValidation: false,
};

const PRODUCTION: ConnectQualityPresetConfig = {
  preset: "production",
  maxChunks: 32,
  maxChunksCeiling: 100,
  minStopAfterStage: "remediating",
  requirePreviewOnPackChange: true,
  requireCrossModelValidation: true,
};

export function resolveQualityPreset(pack: ConnectDomainPack | null | undefined): ConnectQualityPresetConfig {
  const raw = pack?.quality_preset;
  if (raw === "starter") return { ...STARTER };
  return { ...PRODUCTION };
}

export function readMaxChunksForPreset(
  preset: ConnectQualityPresetConfig,
  envOverride?: string | number | null,
): number {
  const fromEnv = Number(envOverride ?? process.env.CONNECT_INGEST_MAX_CHUNKS);
  const envVal = Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : preset.maxChunks;
  return Math.max(1, Math.min(envVal, preset.maxChunksCeiling));
}

/** Effective stop-after: production cannot skip validate/remediate/storing early. */
export function effectiveStopAfterStage(
  requested: ConnectIngestStage | null | undefined,
  preset: ConnectQualityPresetConfig,
): ConnectIngestStage | null {
  if (!requested) {
    return preset.minStopAfterStage;
  }
  if (!preset.minStopAfterStage) return requested;
  const order: ConnectIngestStage[] = [
    "extracting",
    "relating",
    "grouping",
    "embedding",
    "validating",
    "remediating",
    "storing",
  ];
  const reqIdx = order.indexOf(requested);
  const minIdx = order.indexOf(preset.minStopAfterStage);
  if (reqIdx < 0 || minIdx < 0) return requested;
  return reqIdx >= minIdx ? requested : preset.minStopAfterStage;
}

export function starterPresetWarning(): string {
  return "Demo (Starter) quality reduces chunk coverage and skips some production gates. Use Production for agent-facing graphs.";
}
