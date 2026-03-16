/**
 * GET: List request logs for the current workspace. For frontend (Logs & Traces, Analytics).
 * Query: limit, since, until, projectId, routeId.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { listRequestLogs } from "$lib/server/db";

export const GET: RequestHandler = async ({ url, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");
  const projectId = url.searchParams.get("projectId")?.trim() || undefined;
  const routeId = url.searchParams.get("routeId")?.trim() || undefined;

  const sinceNum = since ? parseInt(since, 10) : undefined;
  const untilNum = until ? parseInt(until, 10) : undefined;
  if (since !== undefined && (since === "" || Number.isNaN(sinceNum!))) {
    return json({ error: "Invalid since" }, { status: 400 });
  }
  if (until !== undefined && (until === "" || Number.isNaN(untilNum!))) {
    return json({ error: "Invalid until" }, { status: 400 });
  }

  try {
    const data = await listRequestLogs(ctx.workspaceId, {
      limit,
      since: sinceNum,
      until: untilNum,
      projectId,
      routeId,
    });
    return json({ data });
  } catch (e) {
    console.error("[request-logs] listRequestLogs failed:", e);
    return json({ error: "Failed to load request logs" }, { status: 500 });
  }
};
