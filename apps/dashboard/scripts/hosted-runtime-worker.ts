/**
 * Drain queued hosted runtime jobs (cron / manual). Requires DATABASE_URL.
 *
 * Usage (from repo root): `pnpm --filter dashboard exec tsx --tsconfig apps/dashboard/tsconfig.json apps/dashboard/scripts/hosted-runtime-worker.ts`
 */
import "./load-dashboard-env.mjs";
import { runHostedRuntimeWorkerLoop } from "../src/lib/server/hosted-runtime-worker";

const max = Math.max(1, Number(process.env.HOSTED_RUNTIME_WORKER_MAX_JOBS ?? "50"));

runHostedRuntimeWorkerLoop(max)
  .then((n) => {
    console.log(`hosted-runtime-worker: processed ${n} job(s)`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("hosted-runtime-worker failed:", err);
    process.exit(1);
  });
