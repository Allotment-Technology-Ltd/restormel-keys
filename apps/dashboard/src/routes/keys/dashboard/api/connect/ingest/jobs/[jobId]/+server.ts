/**
 * Session-scoped Knowledge ingest job detail (operator UI). Includes sources.
 */
import { json } from "@sveltejs/kit";
import {
  getConnectIngestJobForWorkspace,
  connectIngestJobRecordToApi,
} from "$lib/server/connect-ingest-jobs";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const row = await getConnectIngestJobForWorkspace({
    jobId: params.jobId,
    workspaceId: ctx.workspaceId,
  });
  if (!row) {
    return json({ error: "not_found", message: "Ingest job not found." }, { status: 404 });
  }
  return json({ job: connectIngestJobRecordToApi(row, { includeSources: true }) });
};
