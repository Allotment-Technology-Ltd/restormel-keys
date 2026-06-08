/**
 * Test connectivity for a multi-database graph store config (Build 2A).
 * POST with no draft fields tests the saved config; POST with draft fields tests
 * the form values without saving. Calls adapter.healthCheck() under the hood.
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import {
  testGraphStoreConfigDraft,
  testSavedGraphStoreConfig,
} from "$lib/server/connect/graph-store-config";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const TestBodySchema = z.object({
  type: z.enum(["neo4j", "weaviate"]).optional(),
  connection_string: z.string().min(1).max(2000).optional(),
  database: z.string().min(1).max(120).optional(),
  username: z.string().min(1).max(120).optional(),
  endpoint: z.string().min(1).max(2000).optional(),
  secret: z.string().min(1).max(4000).optional(),
  use_saved_secret: z.boolean().optional(),
});

export const POST: RequestHandler = async ({ locals, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  let rawBody: unknown = null;
  try {
    rawBody = await request.json();
  } catch {
    rawBody = null;
  }

  const parsed = TestBodySchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return json({ ok: false, message: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  // No draft connection details → test the saved config.
  if (!parsed.data.connection_string && !parsed.data.endpoint) {
    const saved = await testSavedGraphStoreConfig(ctx.workspaceId);
    return json(saved, { status: saved.ok ? 200 : 502 });
  }

  const result = parsed.data.endpoint
    ? await testGraphStoreConfigDraft(ctx.workspaceId, {
        type: "weaviate",
        endpoint: parsed.data.endpoint,
        password: parsed.data.secret,
        useSavedSecret: parsed.data.use_saved_secret,
      })
    : await testGraphStoreConfigDraft(ctx.workspaceId, {
        connectionString: parsed.data.connection_string!,
        database: parsed.data.database,
        username: parsed.data.username,
        password: parsed.data.secret,
        useSavedSecret: parsed.data.use_saved_secret,
      });
  return json(result, { status: result.ok ? 200 : 502 });
};
