/**
 * Connect ingest worker daemon loop (Coolify migration Stage 2.2 — the F9 fix).
 *
 * A long-lived process loops `drainConnectIngestQueue()` on an interval, replacing
 * Vercel's 5-minute cron + post-POST `waitUntil` drain. All durable-run semantics
 * (lease claiming, heartbeats, reclaim of stalled runs, checkpointed resume) live
 * in `connect-ingest-worker.ts` / `connect-ingest-jobs.ts` and are REUSED, not
 * reimplemented — which is also why this daemon is safe to run concurrently with
 * the Vercel cron during the dual-run window: `claimNextPendingConnectIngestJob`
 * is an atomic claim honoring lease expiry, so two drainers never process the
 * same job.
 *
 * Entry point: `apps/dashboard/scripts/connect-ingest-worker-daemon.ts`.
 *
 * Env:
 * - `CONNECT_INGEST_WORKER_INTERVAL_MS` — sleep between drain sweeps
 *   (default 30_000, clamped to [1_000, 900_000]); ±10% jitter is applied per
 *   sweep so the daemon never phase-locks with the cron drain or a second worker.
 * - `KNOWLEDGE_INGEST_WORKER_MAX_JOBS` — max jobs per sweep (drain clamps to 10).
 */
import { drainConnectIngestQueue } from "$lib/server/connect-ingest-worker";

export const CONNECT_INGEST_DAEMON_DEFAULT_INTERVAL_MS = 30_000;
export const CONNECT_INGEST_DAEMON_MIN_INTERVAL_MS = 1_000;
export const CONNECT_INGEST_DAEMON_MAX_INTERVAL_MS = 15 * 60_000;
/** ±10% — bounded so a sweep is never scheduled outside [0.9, 1.1] × base. */
export const CONNECT_INGEST_DAEMON_JITTER_RATIO = 0.1;

export function connectIngestDaemonIntervalMs(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env.CONNECT_INGEST_WORKER_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw <= 0) return CONNECT_INGEST_DAEMON_DEFAULT_INTERVAL_MS;
  return Math.min(
    Math.max(Math.round(raw), CONNECT_INGEST_DAEMON_MIN_INTERVAL_MS),
    CONNECT_INGEST_DAEMON_MAX_INTERVAL_MS,
  );
}

export function connectIngestDaemonMaxJobs(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env.KNOWLEDGE_INGEST_WORKER_MAX_JOBS);
  if (!Number.isFinite(raw) || raw < 1) return 10;
  return Math.max(1, Math.round(raw));
}

/** Jittered sweep interval: base ± JITTER_RATIO (bounded to [0.9, 1.1] × base). */
export function jitterConnectIngestIntervalMs(
  baseMs: number,
  random: () => number = Math.random,
): number {
  const spread = (random() * 2 - 1) * CONNECT_INGEST_DAEMON_JITTER_RATIO; // [-0.1, +0.1)
  return Math.max(0, Math.round(baseMs * (1 + spread)));
}

/** Structured (JSON-line) daemon log entry. */
export type ConnectIngestDaemonLogger = (entry: {
  event: string;
  [key: string]: unknown;
}) => void;

const defaultLogger: ConnectIngestDaemonLogger = (entry) => {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), service: "connect-ingest-worker", ...entry }),
  );
};

export interface ConnectIngestDaemonOptions {
  /** Drain implementation — defaults to the real `drainConnectIngestQueue`. */
  drain?: (opts?: { maxJobs?: number }) => Promise<{ reclaimed: number; processed: number }>;
  intervalMs?: number;
  maxJobsPerSweep?: number;
  /** Abort to request a graceful stop (in-flight sweep finishes first). */
  signal?: AbortSignal;
  /** Stop after N sweeps (tests / one-shot smoke). Unset = run forever. */
  maxSweeps?: number;
  log?: ConnectIngestDaemonLogger;
  random?: () => number;
}

export interface ConnectIngestDaemonResult {
  sweeps: number;
  processed: number;
  reclaimed: number;
  errors: number;
}

/** Abortable sleep — resolves early (never rejects) when the signal fires. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

/**
 * Run the daemon loop: drain → jittered sleep → repeat, until the signal aborts
 * (or `maxSweeps` is reached). Graceful by construction: the loop is sequential,
 * so an abort during a sweep lets the in-flight claim finish its stage and stop
 * its heartbeat (the drain's own `finally`) before the loop exits — no lease is
 * abandoned mid-beat. A drain error is logged and the loop continues; the queue
 * reclaim on the next sweep surfaces anything left stalled.
 */
export async function runConnectIngestWorkerDaemon(
  opts: ConnectIngestDaemonOptions = {},
): Promise<ConnectIngestDaemonResult> {
  const drain = opts.drain ?? drainConnectIngestQueue;
  const intervalMs = opts.intervalMs ?? connectIngestDaemonIntervalMs();
  const maxJobs = opts.maxJobsPerSweep ?? connectIngestDaemonMaxJobs();
  const log = opts.log ?? defaultLogger;
  const random = opts.random ?? Math.random;
  const result: ConnectIngestDaemonResult = { sweeps: 0, processed: 0, reclaimed: 0, errors: 0 };

  log({ event: "daemon_start", interval_ms: intervalMs, max_jobs_per_sweep: maxJobs });

  while (!opts.signal?.aborted) {
    const startedAt = Date.now();
    try {
      const { reclaimed, processed } = await drain({ maxJobs });
      result.processed += processed;
      result.reclaimed += reclaimed;
      if (processed > 0 || reclaimed > 0) {
        log({
          event: "drain_sweep",
          processed,
          reclaimed,
          duration_ms: Date.now() - startedAt,
        });
      }
    } catch (err) {
      result.errors += 1;
      log({
        event: "drain_error",
        error: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - startedAt,
      });
    }
    result.sweeps += 1;
    if (opts.maxSweeps !== undefined && result.sweeps >= opts.maxSweeps) break;
    if (opts.signal?.aborted) break;
    await sleep(jitterConnectIngestIntervalMs(intervalMs, random), opts.signal);
  }

  log({ event: "daemon_stop", ...result });
  return result;
}
