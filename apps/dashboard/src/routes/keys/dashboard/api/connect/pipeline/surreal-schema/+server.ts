/**
 * Discover tables and relation edges in the connected SurrealDB database.
 */
import { json } from "@sveltejs/kit";
import { introspectSurrealGraphSchema } from "$lib/server/connect/surreal-schema-introspect";
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

  const result = await introspectSurrealGraphSchema(ctx.workspaceId);
  if (!result.ok) {
    const status =
      result.error === "no_surreal_target" || result.error === "target_not_ready" ? 409 : 502;
    return json(result, { status });
  }

  return json({
    namespace: result.namespace,
    database: result.database,
    tables: result.tables,
    suggested: result.suggested,
    warnings: result.warnings,
    draft: result.draft,
  });
};
