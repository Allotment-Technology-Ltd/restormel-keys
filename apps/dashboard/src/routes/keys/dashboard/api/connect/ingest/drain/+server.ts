/**
 * Cron-drain for Connect ingest jobs (Stage 1.6 durable run execution).
 *
 * Runs the queue OUTSIDE user request invocations: reclaims stale 'running' jobs
 * whose worker lease expired (recycled instance → visible, restartable failure)
 * and processes pending jobs under this route's own maxDuration budget.
 *
 * Invoked by Vercel cron (see apps/dashboard/vercel.json `crons`): Vercel sends
 * GET with `Authorization: Bearer ${CRON_SECRET}` when the CRON_SECRET env var is
 * set — https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 * A future long-lived worker (Coolify, infra-migration Stage 2) replaces this by
 * calling `drainConnectIngestQueue` on an interval.
 */
import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { dev } from "$app/environment";
import { drainConnectIngestQueue } from "$lib/server/connect-ingest-worker";
import type { RequestHandler } from "./$types";

// Route-level function budget: ingest jobs run LLM stages for minutes. 300s is the
// fluid-compute max on Hobby and safe on every plan; raise toward 800s on Pro.
export const config = { runtime: "nodejs22.x" as const, maxDuration: 300 };

const MAX_JOBS_DEFAULT = 3;

const handler: RequestHandler = async ({ request, url }) => {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) {
    if (!dev) {
      // Fail closed in production: an unauthenticated drain endpoint would let
      // anyone burn the workspace's LLM budget by forcing queue processing.
      return json(
        { error: "cron_secret_not_configured", message: "Set CRON_SECRET to enable the drain route." },
        { status: 503 },
      );
    }
  } else if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  const maxRaw = Number(url.searchParams.get("max") ?? MAX_JOBS_DEFAULT);
  const maxJobs = Number.isFinite(maxRaw) ? Math.min(Math.max(1, Math.round(maxRaw)), 10) : MAX_JOBS_DEFAULT;
  const result = await drainConnectIngestQueue({ maxJobs });
  return json({ ok: true, ...result });
};

export const GET = handler;
export const POST = handler;

// Deploy marker: graphrag-core node-types fix (PR #237) present in this build.
