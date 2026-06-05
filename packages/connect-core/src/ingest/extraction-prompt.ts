/**
 * Compose the extraction prompt from a Domain Pack via the central prompt composer.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ConnectQualityPreset } from "./quality-preset.js";
import {
  composeStageSystemPrompt,
  type GraphIngestContext,
  EXTRACTION_OUTPUT_CONTRACT,
} from "./prompt-compose.js";

export { EXTRACTION_OUTPUT_CONTRACT };

export function buildExtractionSystemPrompt(
  pack: ConnectDomainPack,
  opts?: { qualityPreset?: ConnectQualityPreset; graphContext?: GraphIngestContext },
): string {
  return composeStageSystemPrompt({
    pack,
    stage: "extraction",
    qualityPreset: opts?.qualityPreset ?? pack.quality_preset ?? "production",
    graphContext: opts?.graphContext,
  });
}

export function buildExtractionUserPrompt(text: string): string {
  return `Extract units and relationships from the following text:\n\n${text}`;
}
