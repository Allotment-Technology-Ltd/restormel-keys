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
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const outcome = await handleConnectIngestCreate({ locals, body, idempotencyKey });
  return json(outcome.body, { status: outcome.status });
};

export const GET: RequestHandler = async ({ url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw !== null ? parseInt(limitRaw, 10) : null;
  const cursor = url.searchParams.get("cursor");
  const outcome = await handleConnectIngestList({
    locals,
    workspaceId,
    projectId,
    limit: Number.isFinite(limit) ? limit : null,
    cursor,
  });
  return json(outcome.body, { status: outcome.status });
};
