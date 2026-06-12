/**
 * Connect ingest worker daemon (Coolify migration Stage 2.2 — the F9 fix).
 *
 * Long-running replacement for the Vercel cron + post-POST `waitUntil` drain:
 * loops `drainConnectIngestQueue()` (lease/heartbeat claiming, reclaim of
 * stalled runs, checkpointed resume — all from PR #229, reused unchanged) on a
 * jittered interval. Safe to run concurrently with the Vercel cron during the
 * dual-run window: claims are atomic and lease-aware.
 *
 * Run (repo root):
 *   pnpm --filter dashboard run connect-ingest-worker:daemon
 *
 * Container command (Coolify worker app — same env as the dashboard container,
 * see Dockerfile.worker). node must be PID 1 — a pnpm wrapper does NOT forward
 * SIGTERM, which would break graceful shutdown:
 *   TSX_TSCONFIG_PATH=apps/dashboard/scripts/tsconfig.json \
 *     node --import tsx apps/dashboard/scripts/connect-ingest-worker-daemon.ts
 *
 * Pair with `CONNECT_INGEST_INLINE_DRAIN=0` on the DASHBOARD container so the
 * interactive process never drains — this daemon owns all queue execution.
 *
 * Env:
 * - DATABASE_URL                        required (Neon Postgres)
 * - CONNECT_INGEST_WORKER_INTERVAL_MS   sleep between sweeps (default 30000, ±10% jitter)
 * - KNOWLEDGE_INGEST_WORKER_MAX_JOBS    max jobs per sweep (default 10, drain caps at 10)
 * - CONNECT_INGEST_WORKER_MODE          `full` auto-resolves when a graph store is connected
 *   (plus the full-mode vars in docs/runbooks/connect-ingest-hosted-worker.md)
 *
 * Shutdown: SIGTERM/SIGINT request a graceful stop — the in-flight claim
 * finishes its sweep (heartbeat stops in the drain's own `finally`), then the
 * process exits 0. A second signal forces an immediate exit; any abandoned
 * lease is reclaimed as a visible restartable failure on the next drain.
 */
import "./load-dashboard-env.mjs";
import { runConnectIngestWorkerDaemon } from "../src/lib/server/connect-ingest-daemon";

const controller = new AbortController();
let signalled = false;

function requestStop(signal: NodeJS.Signals): void {
  if (signalled) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "connect-ingest-worker",
        event: "daemon_force_exit",
        signal,
      }),
    );
    process.exit(130);
  }
  signalled = true;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "connect-ingest-worker",
      event: "daemon_shutdown_requested",
      signal,
      note: "finishing in-flight sweep before exit; repeat signal to force",
    }),
  );
  controller.abort();
}

process.on("SIGTERM", () => requestStop("SIGTERM"));
process.on("SIGINT", () => requestStop("SIGINT"));

runConnectIngestWorkerDaemon({ signal: controller.signal })
  .then((result) => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "connect-ingest-worker",
        event: "daemon_exit",
        ...result,
      }),
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error("connect-ingest-worker daemon failed:", err);
    process.exit(1);
  });
