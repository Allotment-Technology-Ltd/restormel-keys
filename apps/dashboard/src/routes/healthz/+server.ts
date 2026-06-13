/**
 * GET /healthz — process-liveness probe.
 *
 * Returns 200 immediately with no DB or external-service calls.
 * Deliberately minimal: the sole purpose is to tell Traefik/Coolify
 * "the Node process is alive and answering HTTP." A DB blip must never
 * cause this to fail — the catalog (which does hit the DB) is the
 * *readiness* surface, not the liveness one.
 *
 * HEALTHCHECK target in Dockerfile.dashboard.
 */
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => {
  return new Response("ok", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // No caching — liveness probes must always be live.
      "cache-control": "no-store",
    },
  });
};
