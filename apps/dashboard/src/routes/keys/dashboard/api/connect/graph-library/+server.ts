/**
 * Graph Library — list every saved graph for the workspace and create new ones.
 * Each entry bundles a graph store connection plus the settings that travel with
 * it (domain pack, ingest selection, stop-after-stage) when it is made active.
 */
import { json } from "@sveltejs/kit";
import { ConnectGraphTargetUpsertSchema } from "@restormel/contracts/connect";
import {
  createGraphTarget,
  listGraphTargetsForUi,
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
  const graphs = await listGraphTargetsForUi(ctx.workspaceId);
  return json({ graphs });
};

export const POST: RequestHandler = async ({ locals, request }) => {
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
  const activate = Boolean((body as { activate?: unknown })?.activate);
  const parsed = ConnectGraphTargetUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const result = await createGraphTarget(ctx.workspaceId, parsed.data, { activate });
  if (!result.ok) {
    return json({ error: result.error, message: result.message }, { status: result.status });
  }
  const test =
    parsed.data.provider === "surreal"
      ? await testGraphTargetConnection(ctx.workspaceId, result.target.id)
      : undefined;
  const graphs = await listGraphTargetsForUi(ctx.workspaceId);
  const target = graphs.find((g) => g.id === result.target.id) ?? result.target;
  return json({ target, graphs, ...(test ? { test } : {}) });
};
