/**
 * GET /connect/v1/ingest/jobs/{jobId}
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleConnectIngestStatus } from "$lib/server/connect-v1/ingest-handler";

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const outcome = await handleConnectIngestStatus({
    locals,
    jobId: params.jobId,
    workspaceId,
    projectId,
  });
  return json(outcome.body, { status: outcome.status });
};
