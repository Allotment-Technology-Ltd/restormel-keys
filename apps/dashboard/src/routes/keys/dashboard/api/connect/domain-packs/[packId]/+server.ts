/**
 * Session-scoped Knowledge domain pack by id (read, update, delete custom packs).
 */
import { json } from "@sveltejs/kit";
import { ConnectDomainPackUpsertSchema } from "@restormel/contracts/connect";
import {
  deleteDomainPack,
  getDomainPackForUi,
  updateDomainPack,
} from "$lib/server/connect/domain-pack-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  let pack;
  try {
    pack = await getDomainPackForUi(ctx.workspaceId, params.packId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unavailable.";
    console.error("[domain-packs GET] load failed:", message.slice(0, 120));
    return json(
      {
        error: "db_unavailable",
        message: "Could not reach the workspace database. Check DATABASE_URL and retry.",
      },
      { status: 503 },
    );
  }
  if (!pack) {
    return json({ error: "not_found", message: "Domain pack not found." }, { status: 404 });
  }
  return json({ pack });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
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
  let result;
  try {
    result = await updateDomainPack(ctx.workspaceId, params.packId, parsed.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update domain pack.";
    if (message.includes("embeddings at")) {
      return json({ error: "embedding_dimensions_locked", message }, { status: 409 });
    }
    return json({ error: "save_failed", message }, { status: 500 });
  }
  if ("error" in result) {
    if (result.error === "not_found") {
      return json({ error: "not_found", message: "Domain pack not found." }, { status: 404 });
    }
    if (result.error === "builtin") {
      return json({ error: "builtin", message: "Built-in domain packs cannot be edited." }, { status: 403 });
    }
    return json(
      { error: "slug_change", message: "Slug cannot be changed when editing. Create a new pack instead." },
      { status: 400 },
    );
  }
  return json({ pack: result.pack });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const result = await deleteDomainPack(ctx.workspaceId, params.packId);
  if ("error" in result) {
    if (result.error === "not_found") {
      return json({ error: "not_found", message: "Domain pack not found." }, { status: 404 });
    }
    return json({ error: "builtin", message: "Built-in domain packs cannot be deleted." }, { status: 403 });
  }
  return json({ deleted: true });
};
