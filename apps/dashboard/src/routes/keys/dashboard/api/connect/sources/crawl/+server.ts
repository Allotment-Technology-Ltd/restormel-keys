/**
 * Website / sitemap crawl: discover and import pages as source documents.
 */
import { json } from "@sveltejs/kit";
import { ConnectCrawlRequestSchema } from "@restormel/contracts/connect";
import { crawlAndImport } from "$lib/server/connect/crawler";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

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
  const parsed = ConnectCrawlRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const result = await crawlAndImport({ workspaceId: ctx.workspaceId, request: parsed.data });
  return json(result, { status: 201 });
};
