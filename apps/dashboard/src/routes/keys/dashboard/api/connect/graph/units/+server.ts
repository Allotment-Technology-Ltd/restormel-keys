/**
 * Paginated graph unit fetch for Connect graph explorer (client load-more).
 */
import { json } from "@sveltejs/kit";
import {
  GRAPH_EXPLORER_PAGE_SIZE,
  loadConnectGraphUnitsPageAsOf,
} from "$lib/server/connect/graph-explorer-service";
import { parseAsOfRequestFromQuery } from "$lib/server/connect/graph-explorer-as-of";
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

  const offset = Math.max(Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
  const limit = Math.min(
    Math.max(Number.parseInt(url.searchParams.get("limit") ?? String(GRAPH_EXPLORER_PAGE_SIZE), 10) || GRAPH_EXPLORER_PAGE_SIZE, 1),
    GRAPH_EXPLORER_PAGE_SIZE,
  );
  const domainPackId = url.searchParams.get("domain_pack_id");

  // W2.5 — as-of time travel: `?as_of=<iso>` (+ `?audit=1` for superseded versions).
  // The projection runs only where the data layer can answer historically (Postgres
  // spine); BYO Surreal / no target degrade explicitly via as_of_status.
  const asOf = parseAsOfRequestFromQuery((k) => url.searchParams.get(k));

  const page = await loadConnectGraphUnitsPageAsOf(ctx.workspaceId, {
    offset,
    limit,
    domainPackId,
    asOf,
  });

  return json({
    units: page.units,
    has_more: page.hasMore,
    total: page.total,
    offset,
    limit,
    domain_pack_id: page.domainPackId,
    units_load_error: page.unitsLoadError ?? null,
    as_of_status: page.asOfStatus,
  });
};
