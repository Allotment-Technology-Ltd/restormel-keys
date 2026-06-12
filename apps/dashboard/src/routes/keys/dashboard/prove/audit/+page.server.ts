/**
 * R5: Prove / Audit tab — moved from /access/audit (D5 approved).
 * Audit log is a proof artefact (ux-contracts §2 registry). Key and config changes
 * are part of the evidentiary chain an external auditor would examine.
 * /access/audit now 308-redirects here; the /access deep link is preserved.
 *
 * W3.7 audit depth: time-range + actor + action filters, cursor pagination.
 * Before: fixed 50 rows, unfiltered, actor shown as type-only (FUNC P2-5).
 * After: filterable by actor, actorType, eventType, date range; keyset pagination (200 cap).
 *
 * Auth: same session-scoped gate as before (audit is not an admin surface).
 * Uses sessionUser helper per W4.6a convention (#288).
 */
import type { PageServerLoad } from "./$types";
import { getOrCreateDefaultWorkspace, listAuditEvents } from "$lib/server/db";
import { sessionUser } from "$lib/server/session-user";

/** Max rows returned per page (hard cap in listAuditEvents is 200). */
const PAGE_SIZE = 50;

export type AuditFilterParams = {
  actor: string;
  actorType: string;
  eventType: string;
  since: number | null;
  until: number | null;
  before: number | null;
};

function parseFilters(url: URL): AuditFilterParams {
  const actor = url.searchParams.get("actor") ?? "";
  const actorType = url.searchParams.get("actorType") ?? "";
  const eventType = url.searchParams.get("eventType") ?? "";

  // Date-range: ISO 8601 or epoch ms.
  const sinceRaw = url.searchParams.get("since");
  const untilRaw = url.searchParams.get("until");
  const beforeRaw = url.searchParams.get("before");

  const since = sinceRaw ? (Number.isFinite(Number(sinceRaw)) ? Number(sinceRaw) : Date.parse(sinceRaw) || null) : null;
  const until = untilRaw ? (Number.isFinite(Number(untilRaw)) ? Number(untilRaw) : Date.parse(untilRaw) || null) : null;
  const before = beforeRaw ? (Number.isFinite(Number(beforeRaw)) ? Number(beforeRaw) : null) : null;

  return { actor, actorType, eventType, since, until, before };
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const su = sessionUser(locals);
  if (!su) {
    return { events: [], error: null as string | null, hasMore: false, filters: parseFilters(url) };
  }
  if (locals.user?.authType === "gateway_key") {
    return { events: [], error: null as string | null, hasMore: false, filters: parseFilters(url) };
  }
  const filters = parseFilters(url);
  try {
    let workspaceId: string;
    if (locals.user!.authType === "management_key" && locals.user!.workspaceId) {
      workspaceId = locals.user!.workspaceId;
    } else {
      const workspace = await getOrCreateDefaultWorkspace(su.uid);
      workspaceId = workspace.id;
    }
    // Fetch PAGE_SIZE + 1 to detect whether there are more rows (keyset pagination).
    const events = await listAuditEvents(workspaceId, {
      limit: PAGE_SIZE + 1,
      since: filters.since ?? undefined,
      until: filters.until ?? undefined,
      before: filters.before ?? undefined,
      actor: filters.actor || undefined,
      actorType: filters.actorType || undefined,
      eventType: filters.eventType || undefined,
    });
    const hasMore = events.length > PAGE_SIZE;
    return { events: hasMore ? events.slice(0, PAGE_SIZE) : events, error: null, hasMore, filters };
  } catch (e) {
    console.error("[prove/audit] load failed:", e);
    return { events: [], error: "Unable to load audit log", hasMore: false, filters };
  }
};
