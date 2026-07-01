/**
 * RES-113 PR-I — pure helpers to map an engine backoff signal onto the ingest job's
 * pipeline stage rows. Kept dependency-free (no DB, no reporter) so the model→pipeline
 * stage mapping, the persisted-state projection, and the set/clear-on-rows transforms
 * are unit-testable in isolation. The DB-bound reporter (`connect-ingest-progress.ts`)
 * composes these.
 */
import {
  isIngestBackoffReasonCode,
  type ConnectIngestStageBackoff,
  type ConnectIngestStageProgress,
} from "@restormel/connect-core";
import type { ConnectIngestStage, ConnectModelStage } from "@restormel/contracts/connect";

/**
 * Map a route-executor model stage (`extraction`/`grouping`/`validation`/`remediation`/
 * `embedding`) onto its job-pipeline stage (`extracting`/…/`embedding`). `extraction`
 * covers both the `extracting` and `relating` pipeline rows; we attribute its backoff to
 * `extracting` (the active rung when the model is being called). Returns `null` for any
 * stage with no model call (e.g. `grouping`→`grouping` is 1:1, but `storing` has none).
 */
const MODEL_TO_PIPELINE_STAGE: Record<ConnectModelStage, ConnectIngestStage> = {
  extraction: "extracting",
  grouping: "grouping",
  validation: "validating",
  remediation: "remediating",
  embedding: "embedding",
};

export function modelStageToPipelineStage(
  stage: ConnectModelStage | string,
): ConnectIngestStage | null {
  return (MODEL_TO_PIPELINE_STAGE as Record<string, ConnectIngestStage>)[stage] ?? null;
}

/** The minimal signal fields the reporter needs to build a persisted backoff state. */
export type ConnectIngestBackoffInput = {
  reasonCode: string;
  attempt: number;
  delayMs: number;
  at?: string;
};

/**
 * Project an engine signal into the serialisable stage-row state, or `null` when the
 * reason code is not one we recognise (defends the persisted shape — never write junk).
 */
export function buildStageBackoffState(
  input: ConnectIngestBackoffInput,
): ConnectIngestStageBackoff | null {
  if (!isIngestBackoffReasonCode(input.reasonCode)) return null;
  const attempt = Number(input.attempt);
  const delayMs = Number(input.delayMs);
  return {
    reason_code: input.reasonCode,
    attempt: Number.isFinite(attempt) ? Math.max(1, Math.round(attempt)) : 1,
    delay_ms: Number.isFinite(delayMs) ? Math.max(0, Math.round(delayMs)) : 0,
    at: input.at ?? new Date().toISOString(),
  };
}

/** Return stage rows with `backoff` set on the target stage (no mutation of the input). */
export function setStageBackoff(
  stages: ConnectIngestStageProgress[],
  target: ConnectIngestStage,
  backoff: ConnectIngestStageBackoff,
): ConnectIngestStageProgress[] {
  return stages.map((row) => (row.stage === target ? { ...row, backoff } : row));
}

/**
 * Return stage rows with `backoff` removed. Pass a `target` to clear one stage, or omit
 * to clear every stage (used when a run settles). Never mutates the input rows.
 */
export function clearStageBackoff(
  stages: ConnectIngestStageProgress[],
  target?: ConnectIngestStage,
): ConnectIngestStageProgress[] {
  return stages.map((row) => {
    if (target && row.stage !== target) return row;
    if (!row.backoff) return row;
    const { backoff: _drop, ...rest } = row;
    return rest;
  });
}

/** True when any stage row currently carries a backoff overlay. */
export function hasActiveStageBackoff(stages: ConnectIngestStageProgress[]): boolean {
  return stages.some((row) => row.backoff != null);
}
