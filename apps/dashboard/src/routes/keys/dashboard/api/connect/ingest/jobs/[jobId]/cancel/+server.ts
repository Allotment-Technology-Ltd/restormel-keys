/**
 * Cancel a pending/running Knowledge ingest job (session-scoped, destructive action).
 */
import { json } from "@sveltejs/kit";
import {
  cancelConnectIngestJobForWorkspace,
  getConnectIngestJobForWorkspace,
  connectIngestJobRecordToApi,
} from "$lib/server/connect-ingest-jobs";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const changed = await cancelConnectIngestJobForWorkspace({
    jobId: params.jobId,
    workspaceId: ctx.workspaceId,
  });
  const row = await getConnectIngestJobForWorkspace({
    jobId: params.jobId,
    workspaceId: ctx.workspaceId,
  });
  if (!row) {
    return json({ error: "not_found", message: "Ingest job not found." }, { status: 404 });
  }
  return json({ cancelled: changed, job: connectIngestJobRecordToApi(row) });
};
