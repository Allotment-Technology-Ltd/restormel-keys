/**
 * Decide whether a pipeline stage should run given an optional stop-after stage.
 * Order: extracting → relating → grouping → embedding → validating → remediating → storing.
 */
import type { ConnectIngestStage } from "@restormel/contracts/connect";

export const CONNECT_STAGE_ORDER: ConnectIngestStage[] = [
  "extracting",
  "relating",
  "grouping",
  "embedding",
  "validating",
  "remediating",
  "storing",
];

export function shouldRunStage(
  stage: ConnectIngestStage,
  stopAfter?: ConnectIngestStage | null,
): boolean {
  if (!stopAfter) return true;
  const stageIdx = CONNECT_STAGE_ORDER.indexOf(stage);
  const stopIdx = CONNECT_STAGE_ORDER.indexOf(stopAfter);
  if (stageIdx < 0 || stopIdx < 0) return true;
  return stageIdx <= stopIdx;
}
