/**
 * Knowledge Ingest jobs — Phase 9 (5b) workspace-scoped persistence.
 * Stage execution remains in SOPHIA workers until 5d.
 */
import { randomUUID } from "node:crypto";
import {
  CONNECT_API_CONTRACT_VERSION,
  ConnectIngestJobCreateRequestSchema,
  ConnectIngestJobSchema,
} from "@restormel/contracts/connect";
import { buildInitialConnectIngestJob } from "@restormel/connect-core";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import {
  getConnectIngestJobForWorkspace,
  insertConnectIngestJob,
  connectIngestJobRecordToApi,
  listConnectIngestJobsForWorkspace,
  listConnectIngestJobLogsSince,
  countConnectIngestJobLogs,
} from "$lib/server/connect-ingest-jobs";

/** Parse a stored bracket-tagged worker log line (`[TAG] message`) into structured fields. */
const BRACKET_LOG_LINE = /^\s*\[([^\]]+)\]\s*(.*)$/;
function parsePublicLogLine(args: { id: number; line: string; createdAtMs: number }): {
  index: number;
  timestamp: string;
  stage: string;
  level: "info" | "warn" | "error";
  message: string;
} {
  const match = args.line.match(BRACKET_LOG_LINE);
  const stage = (match?.[1] ?? "LOG").trim().toUpperCase();
  const message = (match?.[2] ?? args.line).trim();
  const level: "info" | "warn" | "error" =
    stage === "FATAL" || stage === "ERROR"
      ? "error"
      : stage === "WARN" || stage === "WARNING"
        ? "warn"
        : "info";
  return { index: args.id, timestamp: new Date(args.createdAtMs).toISOString(), stage, level, message };
}

export type ConnectIngestHandlerOutcome =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function handleConnectIngestCreate(args: {
  locals: App.Locals;
  body: unknown;
}): Promise<ConnectIngestHandlerOutcome> {
  const parsed = ConnectIngestJobCreateRequestSchema.safeParse(args.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "invalid_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
    };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId: parsed.data.workspace_id,
    projectId: parsed.data.project_id,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  const jobId = randomUUID();
  const job = buildInitialConnectIngestJob({
    id: jobId,
    workspace_id: auth.workspaceId,
    label: parsed.data.label,
    stop_after_stage: parsed.data.stop_after_stage,
  });

  await insertConnectIngestJob({
    id: jobId,
    workspaceId: auth.workspaceId,
    projectId: auth.projectId,
    label: parsed.data.label ?? null,
    stages: job.stages ?? [],
    sources: parsed.data.sources,
    stopAfterStage: parsed.data.stop_after_stage ?? null,
  });

  const validated = ConnectIngestJobSchema.parse(job);
  return {
    ok: true,
    status: 201,
    body: {
      contract_version: CONNECT_API_CONTRACT_VERSION,
      job: validated,
    },
  };
}

export async function handleConnectIngestList(args: {
  locals: App.Locals;
  workspaceId: string | null;
  projectId?: string;
}): Promise<ConnectIngestHandlerOutcome> {
  if (!args.workspaceId) {
    return {
      ok: false,
      status: 400,
      body: { error: "workspace_id_required", message: "Query parameter workspace_id is required" },
    };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId: args.workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  const rows = await listConnectIngestJobsForWorkspace({
    workspaceId: auth.workspaceId,
    projectId: auth.projectId,
  });
  const jobs = rows.map((row) => ConnectIngestJobSchema.parse(connectIngestJobRecordToApi(row)));

  return {
    ok: true,
    status: 200,
    body: {
      contract_version: CONNECT_API_CONTRACT_VERSION,
      jobs,
    },
  };
}

export async function handleConnectIngestStatus(args: {
  locals: App.Locals;
  jobId: string;
  workspaceId: string | null;
  projectId?: string;
}): Promise<ConnectIngestHandlerOutcome> {
  if (!args.workspaceId) {
    return {
      ok: false,
      status: 400,
      body: { error: "workspace_id_required", message: "Query parameter workspace_id is required" },
    };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId: args.workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  const row = await getConnectIngestJobForWorkspace({
    jobId: args.jobId,
    workspaceId: auth.workspaceId,
    projectId: auth.projectId,
  });
  if (!row) {
    return {
      ok: false,
      status: 404,
      body: { error: "not_found", message: "Knowledge ingest job not found" },
    };
  }

  const job = ConnectIngestJobSchema.parse(connectIngestJobRecordToApi(row));
  return {
    ok: true,
    status: 200,
    body: {
      contract_version: CONNECT_API_CONTRACT_VERSION,
      job,
    },
  };
}

/** GET /connect/v1/ingest/jobs/{jobId}/logs — incremental, paginated worker log lines (I11). */
export async function handleConnectIngestLogs(args: {
  locals: App.Locals;
  jobId: string;
  workspaceId: string | null;
  projectId?: string;
  since?: number;
  limit?: number;
}): Promise<ConnectIngestHandlerOutcome> {
  if (!args.workspaceId) {
    return {
      ok: false,
      status: 400,
      body: { error: "workspace_id_required", message: "Query parameter workspace_id is required" },
    };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId: args.workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  // Workspace-scope the job before exposing its logs.
  const row = await getConnectIngestJobForWorkspace({
    jobId: args.jobId,
    workspaceId: auth.workspaceId,
    projectId: auth.projectId,
  });
  if (!row) {
    return { ok: false, status: 404, body: { error: "not_found", message: "Knowledge ingest job not found" } };
  }

  const since = Number.isFinite(args.since) ? Math.max(0, Math.floor(args.since as number)) : 0;
  const limit = Math.min(Math.max(Number.isFinite(args.limit) ? Math.floor(args.limit as number) : 100, 1), 500);

  const [rows, total] = await Promise.all([
    listConnectIngestJobLogsSince({ jobId: args.jobId, sinceId: since, limit }),
    countConnectIngestJobLogs(args.jobId),
  ]);

  const log_lines = rows.map((r) =>
    parsePublicLogLine({ id: r.id, line: r.line, createdAtMs: r.created_at }),
  );
  const next_since = log_lines.length > 0 ? log_lines[log_lines.length - 1].index : since;

  return {
    ok: true,
    status: 200,
    body: {
      contract_version: CONNECT_API_CONTRACT_VERSION,
      job_id: args.jobId,
      log_lines,
      next_since,
      total,
    },
  };
}
