/**
 * Session-scoped Knowledge graph target (Bring-Your-Own store) config.
 * Secret is write-only and encrypted at rest; never echoed back.
 */
import { json } from "@sveltejs/kit";
import { ConnectGraphTargetUpsertSchema } from "@restormel/contracts/connect";
import {
  getGraphTargetForUi,
  saveGraphTarget,
  testGraphTargetConnection,
} from "$lib/server/connect/graph-target-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const target = await getGraphTargetForUi(ctx.workspaceId);
  return json({ target });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = ConnectGraphTargetUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const result = await saveGraphTarget(ctx.workspaceId, parsed.data);
  if (!result.ok) {
    return json({ error: result.error, message: result.message }, { status: result.status });
  }
  const test =
    parsed.data.provider === "surreal"
      ? await testGraphTargetConnection(ctx.workspaceId)
      : undefined;
  const target = test ? (await getGraphTargetForUi(ctx.workspaceId)) ?? result.target : result.target;
  return json({ target, ...(test ? { test } : {}) });
};
