/**
 * One-click connect: paste a SurrealDB connection string, and we parse it,
 * save the (encrypted) target, and test connectivity in a single call.
 * Optional namespace/database/username/secret override parsed values (useful
 * for Surreal Cloud strings that omit ns/db/credentials).
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import {
  parseSurrealConnectionString,
  saveGraphTarget,
  testGraphTargetConnection,
} from "$lib/server/connect/graph-target-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const ConnectSchema = z.object({
  connection_string: z.string().min(1).max(2000),
  namespace: z.string().min(1).max(120).optional(),
  database: z.string().min(1).max(120).optional(),
  username: z.string().min(1).max(120).optional(),
  secret: z.string().min(1).max(2000).optional(),
});

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
  const parsedBody = ConnectSchema.safeParse(body);
  if (!parsedBody.success) {
    return json(
      { error: "invalid_request", message: parsedBody.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const parsed = parseSurrealConnectionString(parsedBody.data.connection_string);
  if (parsed.error) {
    return json({ error: "invalid_connection_string", message: parsed.error }, { status: 400 });
  }

  const endpoint = parsed.endpoint;
  const namespace = parsedBody.data.namespace ?? parsed.namespace;
  const database = parsedBody.data.database ?? parsed.database;
  const username = parsedBody.data.username ?? parsed.username;
  const secret = parsedBody.data.secret ?? parsed.secret;

  if (!endpoint || !namespace || !database) {
    const parsedEndpoint = parsed.endpoint;
    const hasToken = Boolean(secret);
    return json(
      {
        error: "incomplete_connection",
        message: hasToken
          ? "Parsed your endpoint and token. Add namespace and database below, or include --ns and --db in the CLI command."
          : "Parsed the host but need a namespace and database. Add them below, or paste a string like wss://user:pass@host/namespace/database.",
        parsed: { endpoint: parsedEndpoint, namespace, database, username_present: Boolean(username), token_present: hasToken },
      },
      { status: 400 },
    );
  }

  const result = await saveGraphTarget(ctx.workspaceId, {
    provider: "surreal",
    endpoint,
    namespace,
    database,
    ...(username ? { username } : {}),
    ...(secret ? { secret } : {}),
  });
  if (!result.ok) {
    return json({ error: result.error, message: result.message }, { status: result.status });
  }

  const test = await testGraphTargetConnection(ctx.workspaceId);
  return json({ target: result.target, test });
};
