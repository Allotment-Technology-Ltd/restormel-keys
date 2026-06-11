/**
 * POST /connect/v1/memory — agent observation write path (Stage 3.4).
 *
 * Order is security-relevant and fixed:
 *   1. schema validation (size caps live in the contract — ≤10 observations,
 *      text ≤2000, quote ≤2000, context ≤8000 chars),
 *   2. auth (gateway key / management key / session — workspace-scoped, same
 *      authorizeKnowledgeWorkspaceRequest as every Connect v1 surface),
 *   3. per-key rate limit (after auth, so unauthenticated traffic cannot consume or
 *      probe budgets; see memory-rate-limit.ts for the documented window),
 *   4. dependency resolution (store + pack + validation route) — fail-closed 503 when
 *      the judge cannot run; nothing is persisted "to verify later",
 *   5. the gated pipeline (memory-write-service.ts).
 */
import { ConnectMemoryWriteRequestSchema } from "@restormel/contracts/connect";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import {
  checkMemoryWriteRateLimit,
  memoryRateLimitIdentity,
} from "./memory-rate-limit.js";
import {
  executeConnectMemoryWrite,
  resolveMemoryWriteDeps,
  type MemoryWriteDeps,
} from "$lib/server/connect/memory-write-service";

export type ConnectMemoryHandlerOutcome =
  | {
      ok: true;
      status: 200;
      body: import("@restormel/contracts/connect").ConnectMemoryWriteResponse;
    }
  | { ok: false; status: number; body: Record<string, unknown>; retryAfterSeconds?: number };

export async function handleConnectMemoryWrite(args: {
  locals: App.Locals;
  body: unknown;
  requestId: string;
  /** Test seam: inject deps to run the pipeline without store/LLM config. */
  resolveDeps?: (a: {
    auth: { userId: string; projectId: string; workspaceId: string; authType: string };
    requestId: string;
  }) => Promise<{ ok: true; deps: MemoryWriteDeps } | { ok: false; status: number; body: Record<string, unknown> }>;
}): Promise<ConnectMemoryHandlerOutcome> {
  const parsed = ConnectMemoryWriteRequestSchema.safeParse(args.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "invalid_request",
        message: parsed.error.issues
          .map((i) => `${i.path.join(".") || "request"}: ${i.message}`)
          .join("; "),
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

  const keyId = args.locals.user?.keyId?.trim() || null;
  const identity = memoryRateLimitIdentity({
    keyId,
    authType: auth.authType,
    userId: auth.userId,
    projectId: auth.projectId,
  });
  const limit = checkMemoryWriteRateLimit(identity);
  if (!limit.allowed) {
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: limit.retryAfterSeconds,
      body: {
        error: "rate_limited",
        message: `Memory write rate limit reached for this key — retry in ${limit.retryAfterSeconds}s.`,
        retry_after_seconds: limit.retryAfterSeconds,
      },
    };
  }

  const resolveDeps = args.resolveDeps ?? resolveMemoryWriteDeps;
  const resolved = await resolveDeps({
    auth: {
      userId: auth.userId,
      projectId: auth.projectId,
      workspaceId: auth.workspaceId,
      authType: auth.authType,
    },
    requestId: args.requestId,
  });
  if (!resolved.ok) {
    return { ok: false, status: resolved.status, body: resolved.body };
  }

  const outcome = await executeConnectMemoryWrite({
    auth: {
      userId: auth.userId,
      projectId: auth.projectId,
      workspaceId: auth.workspaceId,
      authType: auth.authType,
    },
    keyId,
    observations: parsed.data.observations,
    requestId: args.requestId,
    deps: resolved.deps,
  });
  if (!outcome.ok) {
    return { ok: false, status: outcome.status, body: outcome.body };
  }
  return { ok: true, status: 200, body: outcome.body };
}
