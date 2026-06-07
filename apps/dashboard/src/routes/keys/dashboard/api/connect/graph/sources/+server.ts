/**
 * Graph source catalog — discover sources embedded in a BYO graph store and import
 * their text into the pipeline catalog without re-ingesting.
 *
 * GET  → scan the graph's source table and report which sources have full text
 * POST → copy sources with full text into knowledge_source_documents
 * PATCH → apply manual mapping fields, or auto-apply detected mapping, then re-scan
 */
import { json } from "@sveltejs/kit";
import {
  applyManualSourceTextMapping,
  discoverGraphSources,
  importGraphSourcesToPipeline,
  syncDomainPackFromSourceScan,
} from "$lib/server/connect/graph-source-discovery";
import type { SourceTextSchemaPatch } from "$lib/server/connect/source-text-schema-probe";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  try {
    const autoSyncPack = url.searchParams.get("auto_sync_pack") === "1";
    const packId = url.searchParams.get("domain_pack_id");
    const result = await discoverGraphSources(ctx.workspaceId, {
      autoSyncPack,
      packId: packId || null,
    });
    return json(result);
  } catch (e) {
    console.error("[connect/graph/sources] discover error:", e);
    return json({ error: "internal_error", message: "Could not scan graph sources." }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ locals, request, url }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { domain_pack_id?: string };
    const packId =
      typeof body.domain_pack_id === "string" && body.domain_pack_id.trim()
        ? body.domain_pack_id.trim()
        : url.searchParams.get("domain_pack_id");
    const result = await importGraphSourcesToPipeline(ctx.workspaceId, {
      packId: packId || null,
    });
    return json(result);
  } catch (e) {
    console.error("[connect/graph/sources] import error:", e);
    return json({ error: "internal_error", message: "Could not import sources." }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      domain_pack_id?: string;
      mapping?: SourceTextSchemaPatch;
    };
    const packId = typeof body.domain_pack_id === "string" ? body.domain_pack_id.trim() : "";
    if (!packId) {
      return json(
        { error: "missing_pack_id", message: "domain_pack_id is required to update the domain pack." },
        { status: 400 },
      );
    }

    if (body.mapping && typeof body.mapping === "object") {
      const outcome = await applyManualSourceTextMapping(ctx.workspaceId, packId, body.mapping);
      if (!outcome.ok) {
        const status =
          outcome.error === "builtin_pack" ||
          outcome.error === "invalid_mapping" ||
          outcome.error === "pack_not_found"
            ? 409
            : 502;
        return json({ error: outcome.error, message: outcome.message }, { status });
      }
      return json(outcome.result);
    }

    const outcome = await syncDomainPackFromSourceScan(ctx.workspaceId, packId);
    if (!outcome.ok) {
      const status =
        outcome.error === "builtin_pack" || outcome.error === "no_changes" ? 409 : 502;
      return json({ error: outcome.error, message: outcome.message }, { status });
    }
    return json(outcome.result);
  } catch (e) {
    console.error("[connect/graph/sources] sync-pack error:", e);
    return json({ error: "internal_error", message: "Could not update domain pack mapping." }, { status: 500 });
  }
};
