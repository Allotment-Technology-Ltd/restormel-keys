/**
 * Readiness run detail — fetch a single run, or archive it (PATCH { action: 'archive' }).
 */
import { json } from "@sveltejs/kit";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import { getReadinessRun, updateReadinessRun } from "$lib/server/connect/readiness-runs";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const run = await getReadinessRun({ runId: params.id, workspaceId: ctx.workspaceId });
  if (!run) return json({ error: "not_found", message: "Readiness run not found." }, { status: 404 });
  return json({ run });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
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
  const action =
    body && typeof body === "object" ? (body as Record<string, unknown>).action : undefined;
  if (action !== "archive") {
    return json(
      { error: "invalid_request", message: "Unsupported action — only 'archive' is allowed." },
      { status: 400 },
    );
  }

  const run = await updateReadinessRun({
    runId: params.id,
    workspaceId: ctx.workspaceId,
    status: "archived",
  });
  if (!run) return json({ error: "not_found", message: "Readiness run not found." }, { status: 404 });
  return json({ run });
};
