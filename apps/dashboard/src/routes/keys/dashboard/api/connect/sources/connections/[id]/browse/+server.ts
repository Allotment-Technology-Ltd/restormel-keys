import { json } from "@sveltejs/kit";
import { browseConnection, ConnectionConfigError } from "$lib/server/connect/connections-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  try {
    const refs = await browseConnection({
      workspaceId: ctx.workspaceId,
      connectionId: params.id,
      prefix: url.searchParams.get("prefix") ?? undefined,
    });
    return json({ refs });
  } catch (e) {
    if (e instanceof ConnectionConfigError) {
      return json({ error: "connection_error", message: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "browse failed";
    return json({ error: "browse_failed", message: msg.slice(0, 200) }, { status: 502 });
  }
};
