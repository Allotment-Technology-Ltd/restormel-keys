/**
 * Live-run chip model (Stage R6, §3.2 topbar).
 *
 * Pure, dependency-free derivation of the topbar live-run chip from a workspace's
 * ingest-job list. The chip tethers the operator to an active run from any page:
 * `● INGEST 62% · 2:41`, amber on stall, gone at zero.
 *
 * Staleness REUSES the W1.4 model (heartbeat / lease durable-run signals) via the
 * same decision tree as the run console's `isStalled` — promoted here into the
 * chrome rather than re-derived. Kept as a pure function so the component test can
 * drive active / stalled / zero states off a mocked status stream without timers.
 */

import { STALL_NOTICE_MS } from "$lib/connect/run-stall";

/** Minimal shape the chip needs from a `/api/connect/ingest/jobs` row. */
export type LiveRunChipJob = {
  id: string;
  status: string;
  label?: string;
  created_at: string;
  updated_at?: string;
  progress?: { percent?: number } | null;
  /** Stage 1.6 durable-run signal — Unix ms of the last worker heartbeat. */
  worker_heartbeat_at?: number | null;
  /** Stage 1.6 durable-run signal — Unix ms at which the lease expires. */
  lease_expires_at?: number | null;
};

/**
 * Heartbeat-stall threshold for the chip. Re-exports the shared
 * `STALL_NOTICE_MS` (90s) so the chrome and the run console agree on "stalled"
 * from ONE definition (`$lib/connect/run-stall`). Kept as a named alias for the
 * chip's existing consumers/tests.
 */
export const CHIP_STALL_NOTICE_MS = STALL_NOTICE_MS;

export type LiveRunChipState = {
  /** The run the chip points at, or null when there is no active run. */
  runId: string;
  /** 0–100, clamped. */
  percent: number;
  /** Elapsed wall-clock since the run was created, formatted `m:ss`. */
  elapsed: string;
  /** True when the active run's worker signal has gone stale (amber). */
  stalled: boolean;
  /** Optional run label for the accessible name. */
  label: string | null;
};

/** A run is "active" while it is pending or running. */
function isActive(status: string): boolean {
  return status === "pending" || status === "running";
}

/**
 * True when an active job's worker signal has gone stale — the W1.4 model.
 * Legacy rows without durable-run columns can't be judged, so they read healthy.
 */
export function isLiveRunStalled(job: LiveRunChipJob, nowMs: number): boolean {
  if (!isActive(job.status)) return false;
  const hb = job.worker_heartbeat_at;
  const lease = job.lease_expires_at;
  if (hb == null && lease == null) return false; // legacy row — can't tell
  if (lease != null && lease < nowMs) return true; // lease expired
  if (hb != null && nowMs - hb > CHIP_STALL_NOTICE_MS) return true; // heartbeat stale
  return false;
}

/** Format an elapsed duration (ms) as `m:ss`; clamps negatives to `0:00`. */
export function formatChipElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clampPercent(raw: number | undefined | null): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Derive the chip state from the workspace's job list at `nowMs`.
 *
 * Returns `null` when no run is active (the chip is then absent from the topbar —
 * it never renders an empty shell). When several runs are active (rare), the most
 * recently created one wins, so the chip tracks the run the operator just started.
 */
export function deriveLiveRunChip(
  jobs: readonly LiveRunChipJob[] | null | undefined,
  nowMs: number,
): LiveRunChipState | null {
  if (!Array.isArray(jobs) || jobs.length === 0) return null;
  const active = jobs.filter((j) => isActive(j.status));
  if (active.length === 0) return null;

  const job = active.reduce((latest, candidate) =>
    new Date(candidate.created_at).getTime() > new Date(latest.created_at).getTime()
      ? candidate
      : latest,
  );

  const startedMs = new Date(job.created_at).getTime();
  return {
    runId: job.id,
    percent: clampPercent(job.progress?.percent),
    elapsed: formatChipElapsed(nowMs - startedMs),
    stalled: isLiveRunStalled(job, nowMs),
    label: job.label ?? null,
  };
}
