/**
 * Stuck-run detection for the ingest runs list.
 *
 * A run is "stuck" only when Stage 1.6 durable-run signals (lease expiry /
 * heartbeat staleness) indicate the worker is genuinely gone, or when the run
 * is already in a terminal cleanup state (failed / cancelled).
 *
 * Healthy in-progress runs (running / pending with a valid lease) are NEVER
 * counted as stuck — doing so would invite operators to kill their own live runs.
 */

export type StuckCheckJob = {
  status: string;
  /** Unix-ms of the last worker heartbeat (Stage 1.6 durable-run column). */
  worker_heartbeat_at?: number | null;
  /** Unix-ms at which the lease expires (Stage 1.6 durable-run column). */
  lease_expires_at?: number | null;
};

/**
 * Threshold beyond which a heartbeat-bearing run with no valid lease is
 * considered stalled. Matches the graph-repair panel's `STALE_MS` constant.
 */
export const STALE_HEARTBEAT_MS = 5 * 60 * 1000; // 5 min

/**
 * Returns true when a job should be counted in the "stuck / cleanup" bucket.
 *
 * Decision tree:
 *  - failed / cancelled  → always stuck (terminal, safe to delete)
 *  - running / pending + lease_expires_at in the past → stuck (lease expired)
 *  - running / pending + worker_heartbeat_at stale > threshold, no valid lease → stuck
 *  - running / pending with a valid lease or no columns (legacy) → NOT stuck
 *  - any other status → NOT stuck
 *
 * @param job   Partial job record from the API.
 * @param nowMs Current time in Unix ms (defaults to Date.now(); inject in tests).
 */
export function isJobStuck(job: StuckCheckJob, nowMs = Date.now()): boolean {
  if (job.status === "failed" || job.status === "cancelled") return true;
  if (job.status !== "running" && job.status !== "pending") return false;

  // Lease-bearing run: expired lease means the server will/has reclaimed it.
  if (job.lease_expires_at != null) {
    return job.lease_expires_at < nowMs;
  }

  // Legacy row (no lease column yet): fall back to heartbeat staleness.
  if (job.worker_heartbeat_at != null) {
    return nowMs - job.worker_heartbeat_at > STALE_HEARTBEAT_MS;
  }

  // No durable-run columns: cannot determine stall state — assume healthy.
  return false;
}
