import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { aggregateRequestLogsToUsage, listRequestLogs } from "$lib/server/db";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;

export const load: PageServerLoad = async ({ url, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) {
    return {
      aggregates: [],
      recentLogs: [],
      period: { since: 0, until: 0 },
      days: DEFAULT_DAYS,
      error: "Unauthorized" as string | null,
    };
  }
  const daysParam = url.searchParams.get("days");
  const days = Math.min(
    MAX_DAYS,
    Math.max(1, parseInt(daysParam ?? String(DEFAULT_DAYS), 10) || DEFAULT_DAYS)
  );
  const until = Date.now();
  const since = until - days * 24 * 60 * 60 * 1000;
  try {
    const [aggregates, recentLogs] = await Promise.all([
      aggregateRequestLogsToUsage(ctx.workspaceId, { since, until }),
      listRequestLogs(ctx.workspaceId, { limit: 50, since, until }),
    ]);
    return {
      aggregates,
      recentLogs,
      period: { since, until },
      days,
      error: null,
    };
  } catch (e) {
    console.error("[analytics] load failed:", e);
    return {
      aggregates: [],
      recentLogs: [],
      period: { since, until },
      days,
      error: "Unable to load analytics",
    };
  }
};
