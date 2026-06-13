/**
 * POST /connect/v1/eval/verdicts — persist an eval verdict (CLI / CI action → dashboard).
 * GET  /connect/v1/eval/verdicts — list the workspace's quality-history timeline.
 *
 * Auth: Gateway key, management key, or dashboard session — same pattern as the other
 * Knowledge v1 routes (authorizeKnowledgeWorkspaceRequest).
 *
 * Stage 2.4 of docs/product/verified-context-pivot-roadmap.md.
 */
import {
  CONNECT_EVAL_VERDICT_SCHEMA_VERSION,
  ConnectEvalVerdictIngestSchema,
  type ConnectEvalVerdictEntry,
  type ConnectEvalVerdictHistoryResponse,
  type ConnectEvalVerdictIngestResponse,
} from "@restormel/contracts";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import {
  insertConnectEvalVerdict,
  listConnectEvalVerdicts,
} from "$lib/server/neon";

export type EvalHistoryPostOutcome =
  | { ok: true; status: 201; body: ConnectEvalVerdictIngestResponse }
  | { ok: false; status: number; body: Record<string, unknown> };

export type EvalHistoryGetOutcome =
  | { ok: true; status: 200; body: ConnectEvalVerdictHistoryResponse }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Handle POST /connect/v1/eval/verdicts — CLI or CI action persists a verdict to the
 * workspace's quality-history timeline.
 */
export async function handlePostEvalVerdict(args: {
  locals: App.Locals;
  workspaceId: string | null;
  projectId?: string;
  body: unknown;
}): Promise<EvalHistoryPostOutcome> {
  const workspaceId = args.workspaceId?.trim();
  if (!workspaceId) {
    return {
      ok: false,
      status: 400,
      body: { error: "invalid_request", message: "workspace_id is required" },
    };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  const parsed = ConnectEvalVerdictIngestSchema.safeParse(args.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      body: {
        error: "validation_error",
        message: "Request body does not match the ConnectEvalVerdictIngest schema",
        issues: parsed.error.issues,
      },
    };
  }

  const { source, verdict, diff } = parsed.data;
  const evaluatedAt = verdict.evaluated_at;

  try {
    const result = await insertConnectEvalVerdict({
      workspaceId: auth.workspaceId,
      source,
      evaluatedAt,
      pass: verdict.pass,
      verdictSchema: CONNECT_EVAL_VERDICT_SCHEMA_VERSION,
      verdict,
      diff: diff ?? null,
    });
    return {
      ok: true,
      status: 201,
      body: { id: result.id, recorded_at: result.recordedAt },
    };
  } catch {
    return {
      ok: false,
      status: 500,
      body: { error: "storage_error", message: "Failed to persist the eval verdict." },
    };
  }
}

/**
 * Handle GET /connect/v1/eval/verdicts — list the workspace's quality-history timeline,
 * newest first, with optional pagination via cursor (before_id).
 */
export async function handleListEvalVerdicts(args: {
  locals: App.Locals;
  workspaceId: string | null;
  projectId?: string;
  limit: number | null;
  beforeId: string | null;
}): Promise<EvalHistoryGetOutcome> {
  const workspaceId = args.workspaceId?.trim();
  if (!workspaceId) {
    return {
      ok: false,
      status: 400,
      body: { error: "invalid_request", message: "workspace_id is required" },
    };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId,
    projectId: args.projectId,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  try {
    // Request one extra to detect whether a next page exists.
    const pageSize = Math.min(Math.max(1, args.limit ?? 25), 100);
    const rows = await listConnectEvalVerdicts({
      workspaceId: auth.workspaceId,
      limit: pageSize + 1,
      beforeId: args.beforeId ?? null,
    });

    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.id : undefined;

    const entries: ConnectEvalVerdictEntry[] = page.map((row) => ({
      id: row.id,
      workspace_id: row.workspaceId,
      recorded_at: row.recordedAt,
      source: row.source as ConnectEvalVerdictEntry["source"],
      verdict: row.verdict as ConnectEvalVerdictEntry["verdict"],
      diff: (row.diff as ConnectEvalVerdictEntry["diff"]) ?? null,
    }));

    return {
      ok: true,
      status: 200,
      body: {
        entries,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      },
    };
  } catch {
    return {
      ok: false,
      status: 502,
      body: { error: "storage_error", message: "Failed to read the eval verdict history." },
    };
  }
}
