import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { listAuditEvents } from "$lib/server/db";

export const GET: RequestHandler = async ({ url, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const since = url.searchParams.get("since");
  const sinceNum = since ? parseInt(since, 10) : undefined;
  try {
    const events = await listAuditEvents(ctx.workspaceId, {
      limit: Number.isNaN(limit) ? 50 : limit,
      since: sinceNum && !Number.isNaN(sinceNum) ? sinceNum : undefined,
    });
    return json({ data: events });
  } catch (e) {
    console.error("[audit] listAuditEvents failed:", e);
    return json({ error: "Failed to load audit log" }, { status: 500 });
  }
};
