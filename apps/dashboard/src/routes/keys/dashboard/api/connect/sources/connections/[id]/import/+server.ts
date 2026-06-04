import { json } from "@sveltejs/kit";
import { ConnectConnectorImportSchema } from "@restormel/contracts/connect";
import { ConnectionConfigError, importDocuments } from "$lib/server/connect/connections-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params, request }) => {
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
  const parsed = ConnectConnectorImportSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  try {
    const documents = await importDocuments({
      workspaceId: ctx.workspaceId,
      connectionId: params.id,
      refs: parsed.data.refs,
    });
    return json({ documents }, { status: 201 });
  } catch (e) {
    if (e instanceof ConnectionConfigError) {
      return json({ error: "connection_error", message: e.message }, { status: 400 });
    }
    throw e;
  }
};
