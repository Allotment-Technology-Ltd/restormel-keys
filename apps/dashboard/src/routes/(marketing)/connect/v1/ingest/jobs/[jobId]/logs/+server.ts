/**
 * GET /connect/v1/ingest/jobs/{jobId}/logs?since=&limit= — live worker log streaming (I11).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleConnectIngestLogs } from "$lib/server/connect-v1/ingest-handler";

function parseIntParam(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const since = parseIntParam(url.searchParams.get("since"));
  const limit = parseIntParam(url.searchParams.get("limit"));
  const outcome = await handleConnectIngestLogs({
    locals,
    jobId: params.jobId,
    workspaceId,
    projectId,
    since,
    limit,
  });
  return json(outcome.body, { status: outcome.status });
};
