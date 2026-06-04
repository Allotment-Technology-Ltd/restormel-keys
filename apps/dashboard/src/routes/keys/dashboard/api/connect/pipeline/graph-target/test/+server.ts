/**
 * Test connectivity to the workspace graph store.
 * POST with no body tests the saved target; POST with draft fields tests the form without saving.
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import {
  parseSurrealConnectionString,
  testGraphTargetConnection,
  testGraphTargetDraft,
} from "$lib/server/connect/graph-target-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const TestBodySchema = z.object({
  endpoint: z.string().min(1).max(500).optional(),
  namespace: z.string().min(1).max(120).optional(),
  database: z.string().min(1).max(120).optional(),
  username: z.string().min(1).max(120).optional(),
  secret: z.string().min(1).max(2000).optional(),
  connection_string: z.string().min(1).max(2000).optional(),
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

  const hasDraftBody =
    rawBody &&
    typeof rawBody === "object" &&
    !Array.isArray(rawBody) &&
    Object.keys(rawBody as object).length > 0;

  if (!hasDraftBody) {
    const result = await testGraphTargetConnection(ctx.workspaceId);
    return json(result, { status: result.ok ? 200 : 502 });
  }

  const parsedBody = TestBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return json(
      { ok: false, message: parsedBody.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  let endpoint = parsedBody.data.endpoint;
  let namespace = parsedBody.data.namespace;
  let database = parsedBody.data.database;
  let username = parsedBody.data.username;
  let secret = parsedBody.data.secret;

  if (parsedBody.data.connection_string) {
    const parsedConn = parseSurrealConnectionString(parsedBody.data.connection_string);
    if (parsedConn.error && !parsedConn.endpoint) {
      return json({ ok: false, message: parsedConn.error }, { status: 400 });
    }
    endpoint = endpoint ?? parsedConn.endpoint;
    namespace = namespace ?? parsedConn.namespace;
    database = database ?? parsedConn.database;
    username = username ?? parsedConn.username;
    secret = secret ?? parsedConn.secret;
  }

  if (!endpoint || !namespace || !database) {
    return json(
      {
        ok: false,
        message:
          "Need endpoint, namespace, and database to test. Fill the manual fields or include them in your CLI paste.",
      },
      { status: 400 },
    );
  }

  const result = await testGraphTargetDraft(ctx.workspaceId, {
    endpoint,
    namespace,
    database,
    username,
    secret,
    useSavedSecret: parsedBody.data.use_saved_secret,
  });
  return json(result, { status: result.ok ? 200 : 502 });
};
