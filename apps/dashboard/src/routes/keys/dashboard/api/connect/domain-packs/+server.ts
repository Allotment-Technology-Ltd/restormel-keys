/**
 * Session-scoped Knowledge domain packs (the customisable, domain-agnostic config layer).
 * GET seeds built-in packs (generic + philosophy) on first use.
 */
import { json } from "@sveltejs/kit";
import { ConnectDomainPackUpsertSchema } from "@restormel/contracts/connect";
import {
  listDomainPacksForUi,
  saveDomainPack,
  getSelectedDomainPackId,
  setSelectedDomainPackId,
} from "$lib/server/connect/domain-pack-service";
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
  const packs = await listDomainPacksForUi(ctx.workspaceId);
  const selected_domain_pack_id = await getSelectedDomainPackId(ctx.workspaceId);
  return json({ packs, selected_domain_pack_id });
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
  const parsed = ConnectDomainPackUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  if (parsed.data.slug === "generic" || parsed.data.slug === "philosophy") {
    return json(
      { error: "reserved_slug", message: "Slugs 'generic' and 'philosophy' are built-in; choose another slug." },
      { status: 400 },
    );
  }
  const pack = await saveDomainPack(ctx.workspaceId, parsed.data);
  return json({ pack }, { status: 201 });
};
