/**
 * Incremental live status for Connect ingest run console (SOPHIA-style ?since= log cursor).
 */
import { json } from "@sveltejs/kit";
import {
  getConnectIngestJobForWorkspace,
  connectIngestJobRecordToApi,
  listConnectIngestJobLogsSince,
  countConnectIngestJobLogs,
} from "$lib/server/connect-ingest-jobs";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params, url }) => {
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

  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw != null ? Math.max(0, Number.parseInt(sinceRaw, 10) || 0) : 0;
  const logRows = await listConnectIngestJobLogsSince({
    jobId: params.jobId,
    sinceId: since > 0 ? since : undefined,
  });
  const logLineTotal = await countConnectIngestJobLogs(params.jobId);
  const lastId = logRows.length > 0 ? logRows[logRows.length - 1]!.id : since;

  return json({
    workspace_id: ctx.workspaceId,
    job: connectIngestJobRecordToApi(row, { includeSources: false }),
    log_lines: logRows.map((r) => r.line),
    log_line_total: logLineTotal,
    since: lastId,
  });
};
