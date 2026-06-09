/**
 * GET /connect/v1/traces/{traceId} and …/export — provenance trace retrieval (Stage 4B).
 *
 * Workspace-scoped: the caller must authorize against the trace's workspace. A trace owned by a
 * different workspace is reported as 404 (never leak existence across tenants).
 */
import type { ProvenanceTrace } from "@restormel/contracts/provenance-trace";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import { getProvenanceTraceById } from "$lib/server/connect-traces";

export type TraceHandlerOutcome =
  | { ok: true; status: 200; trace: ProvenanceTrace }
  | { ok: false; status: number; body: Record<string, unknown> };

async function resolveAuthorizedTrace(args: {
  locals: App.Locals;
  traceId: string;
  workspaceId: string | null;
  projectId?: string;
}): Promise<TraceHandlerOutcome> {
  const workspaceId = args.workspaceId?.trim();
  if (!workspaceId) {
    return { ok: false, status: 400, body: { error: "invalid_request", message: "workspace_id is required" } };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  const record = await getProvenanceTraceById(args.traceId).catch(() => null);
  // Not found, expired, or cross-tenant → uniform 404 (no existence leak).
  if (!record || record.workspaceId !== auth.workspaceId) {
    return { ok: false, status: 404, body: { error: "not_found", message: "Trace not found" } };
  }

  return { ok: true, status: 200, trace: record.trace };
}

export async function handleGetProvenanceTrace(args: {
  locals: App.Locals;
  traceId: string;
  workspaceId: string | null;
  projectId?: string;
}): Promise<TraceHandlerOutcome> {
  return resolveAuthorizedTrace(args);
}

export async function handleExportProvenanceTrace(args: {
  locals: App.Locals;
  traceId: string;
  workspaceId: string | null;
  projectId?: string;
  format: string | null;
}): Promise<TraceHandlerOutcome> {
  const format = (args.format ?? "json").toLowerCase();
  if (format !== "json") {
    return {
      ok: false,
      status: 400,
      body: { error: "unsupported_format", message: "Only format=json is supported" },
    };
  }
  return resolveAuthorizedTrace(args);
}
