/**
 * POST /connect/v1/testing/verdicts — persist a testing run verdict (CI action / CLI).
 * GET  /connect/v1/testing/verdicts — list the workspace's testing verdict timeline.
 *
 * Auth: Gateway key (rk_…) — same pattern as the other v1 routes.
 * Rate-limited using the same in-process fixed-window guard used by memory writes
 * (per-workspace identity on POSTs, no limit on GETs which are read-only).
 *
 * W3.8 — docs/dashboard-world-class-roadmap.md §Stage W3.8
 */
import {
  TESTING_VERDICT_SCHEMA_VERSION,
  TestingVerdictIngestSchema,
  type TestingVerdictEntry,
  type TestingVerdictHistoryResponse,
  type TestingVerdictIngestResponse,
} from "@restormel/contracts";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import { insertTestingVerdict, listTestingVerdicts } from "$lib/server/neon";

// ── Rate limit for POST (in-process fixed window, consistent with memory writes) ──

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20; // generously more than eval verdicts: testing suites can be frequent

type WindowState = { windowStartMs: number; count: number };
const rateLimitWindows = new Map<string, WindowState>();

function checkRateLimit(workspaceId: string, nowMs = Date.now()): { allowed: boolean; retryAfterSeconds?: number } {
  const state = rateLimitWindows.get(workspaceId);
  if (!state || nowMs - state.windowStartMs >= RATE_WINDOW_MS) {
    rateLimitWindows.set(workspaceId, { windowStartMs: nowMs, count: 1 });
    return { allowed: true };
  }
  if (state.count >= RATE_LIMIT) {
    const retryAfterMs = state.windowStartMs + RATE_WINDOW_MS - nowMs;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  state.count += 1;
  return { allowed: true };
}

/** Test hook: reset rate limit windows. */
export function _resetTestingVerdictRateLimit(): void {
  rateLimitWindows.clear();
}

// ── Handler types ───────────────────────────────────────────────────────────

export type TestingVerdictPostOutcome =
  | { ok: true; status: 201; body: TestingVerdictIngestResponse }
  | { ok: false; status: number; body: Record<string, unknown> };

export type TestingVerdictGetOutcome =
  | { ok: true; status: 200; body: TestingVerdictHistoryResponse }
  | { ok: false; status: number; body: Record<string, unknown> };

// ── POST handler ─────────────────────────────────────────────────────────────

/**
 * Handle POST /connect/v1/testing/verdicts — CI action or CLI persists a testing
 * run verdict to the workspace's testing timeline.
 */
export async function handlePostTestingVerdict(args: {
  locals: App.Locals;
  workspaceId: string | null;
  projectId?: string;
  body: unknown;
}): Promise<TestingVerdictPostOutcome> {
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

  // Rate limit: auth FIRST, then limit — unauthenticated traffic cannot probe budget.
  const rl = checkRateLimit(auth.workspaceId);
  if (!rl.allowed) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "rate_limited",
        message: `Too many testing verdicts. Retry after ${rl.retryAfterSeconds}s.`,
        retry_after_seconds: rl.retryAfterSeconds,
      },
    };
  }

  const parsed = TestingVerdictIngestSchema.safeParse(args.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      body: {
        error: "validation_error",
        message: "Request body does not match the TestingVerdictIngest schema",
        issues: parsed.error.issues,
      },
    };
  }

  try {
    const result = await insertTestingVerdict({
      workspaceId: auth.workspaceId,
      evaluatedAt: parsed.data.evaluated_at,
      pass: parsed.data.pass,
      verdictSchema: TESTING_VERDICT_SCHEMA_VERSION,
      verdict: parsed.data,
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
      body: { error: "storage_error", message: "Failed to persist the testing verdict." },
    };
  }
}

// ── GET handler ──────────────────────────────────────────────────────────────

/**
 * Handle GET /connect/v1/testing/verdicts — list the workspace's testing verdict
 * timeline, newest first, with optional cursor pagination (before_id).
 */
export async function handleListTestingVerdicts(args: {
  locals: App.Locals;
  workspaceId: string | null;
  projectId?: string;
  limit: number | null;
  beforeId: string | null;
}): Promise<TestingVerdictGetOutcome> {
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
    const pageSize = Math.min(Math.max(1, args.limit ?? 25), 100);
    const rows = await listTestingVerdicts({
      workspaceId: auth.workspaceId,
      limit: pageSize + 1,
      beforeId: args.beforeId ?? null,
    });

    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.id : undefined;

    const entries: TestingVerdictEntry[] = page.map((row) => ({
      id: row.id,
      workspace_id: row.workspaceId,
      recorded_at: row.recordedAt,
      verdict: row.verdict as TestingVerdictEntry["verdict"],
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
      body: { error: "storage_error", message: "Failed to read the testing verdict history." },
    };
  }
}
