/**
 * Drain pending hosted Knowledge Ingest jobs. Requires DATABASE_URL.
 *
 * Default mode (`CONNECT_INGEST_WORKER_MODE` unset or not `full`): bookkeeping stub
 * that validates sources and marks stages completed (no LLM / graph store).
 *
 * Usage (repo root):
 *   pnpm --filter dashboard run connect-ingest-worker
 */
import "./load-dashboard-env.mjs";
import { runConnectIngestWorkerLoop } from "../src/lib/server/connect-ingest-worker";

const max = Math.max(1, Number(process.env.CONNECT_INGEST_WORKER_MAX_JOBS ?? "25"));

runConnectIngestWorkerLoop(max)
  .then((n) => {
    console.log(`connect-ingest-worker: processed ${n} job(s)`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("connect-ingest-worker failed:", err);
    process.exit(1);
  });
