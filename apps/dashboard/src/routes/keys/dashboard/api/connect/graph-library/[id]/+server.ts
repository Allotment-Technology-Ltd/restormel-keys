/**
 * Graph Library entry — edit a saved graph in place (PUT) or remove it (DELETE).
 * Editing the active graph re-hydrates the live routing config from its bundle.
 */
import { json } from "@sveltejs/kit";
import { ConnectGraphTargetUpsertSchema } from "@restormel/contracts/connect";
import {
  updateGraphTarget,
  removeGraphTarget,
  listGraphTargetsForUi,
} from "$lib/server/connect/graph-target-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const PUT: RequestHandler = async ({ locals, request, params }) => {
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
  const result = await updateGraphTarget(ctx.workspaceId, params.id, parsed.data);
  if (!result.ok) {
    return json({ error: result.error, message: result.message }, { status: result.status });
  }
  const graphs = await listGraphTargetsForUi(ctx.workspaceId);
  const target = graphs.find((g) => g.id === result.target.id) ?? result.target;
  return json({ target, graphs });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const result = await removeGraphTarget(ctx.workspaceId, params.id);
  if (!result.ok) {
    return json({ error: result.error, message: "Graph not found." }, { status: result.status });
  }
  const graphs = await listGraphTargetsForUi(ctx.workspaceId);
  return json({ ok: true, nextActiveId: result.nextActiveId, graphs });
};
