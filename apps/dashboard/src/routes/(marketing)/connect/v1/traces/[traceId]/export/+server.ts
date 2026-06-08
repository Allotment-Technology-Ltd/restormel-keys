/**
 * GET /connect/v1/traces/{traceId}/export?format=json — downloadable provenance trace.
 *
 * Same auth/scoping as GET /connect/v1/traces/{traceId}, but sets Content-Disposition so the
 * browser/CLI saves the trace as a file. Only format=json is supported in v1.0.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleExportProvenanceTrace } from "$lib/server/connect-v1/trace-handler";

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const format = url.searchParams.get("format");
  const outcome = await handleExportProvenanceTrace({
    locals,
    traceId: params.traceId,
    workspaceId,
    projectId,
    format,
  });
  if (!outcome.ok) {
    return json(outcome.body, { status: outcome.status });
  }
  const filename = `provenance-trace-${params.traceId}.json`;
  return new Response(JSON.stringify(outcome.trace, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};
