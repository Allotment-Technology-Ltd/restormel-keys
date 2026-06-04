/**
 * POST /connect/v1/ingest/jobs — create job
 * GET  /connect/v1/ingest/jobs — list jobs
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  handleConnectIngestCreate,
  handleConnectIngestList,
} from "$lib/server/connect-v1/ingest-handler";

export const POST: RequestHandler = async ({ request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }
  const outcome = await handleConnectIngestCreate({ locals, body });
  return json(outcome.body, { status: outcome.status });
};

export const GET: RequestHandler = async ({ url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const outcome = await handleConnectIngestList({
    locals,
    workspaceId,
    projectId,
  });
  return json(outcome.body, { status: outcome.status });
};
