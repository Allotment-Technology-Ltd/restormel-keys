/**
 * POST — idempotently load the first-graph philosophy starter corpus (3 demo documents).
 */
import { json } from "@sveltejs/kit";
import { loadStarterCorpus } from "$lib/server/connect/starter-corpus";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  try {
    const result = await loadStarterCorpus(ctx.workspaceId);
    return json(result, { status: result.already_loaded ? 200 : 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load starter corpus.";
    return json({ error: "starter_corpus_failed", message }, { status: 500 });
  }
};
