/**
 * Set the workspace default domain pack for pipeline runs and previews.
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { setSelectedDomainPackId } from "$lib/server/connect/domain-pack-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const SelectionSchema = z.object({
  domain_pack_id: z.string().uuid(),
});

export const PUT: RequestHandler = async ({ locals, request }) => {
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
  const parsed = SelectionSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const result = await setSelectedDomainPackId(ctx.workspaceId, parsed.data.domain_pack_id);
  if ("error" in result) {
    return json({ error: "not_found", message: "Domain pack not found." }, { status: 404 });
  }
  return json({ selected_domain_pack_id: parsed.data.domain_pack_id });
};
