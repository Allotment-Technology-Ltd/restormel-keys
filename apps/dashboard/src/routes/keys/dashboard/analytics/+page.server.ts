import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { aggregateRequestLogsToUsage, listRequestLogs } from "$lib/server/db";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;

function aggregateFromRecentLogs(
  logs: Array<{
    projectId: string;
    routeId: string | null;
    providerType: string;
    finalModelId: string | null;
    latencyMs: number;
    requestStatus: string;
  }>
) {
  const buckets = new Map<
    string,
    {
      projectId: string | null;
      routeId: string | null;
      providerType: string | null;
      modelId: string | null;
      requestCount: number;
      latencyTotal: number;
      errorCount: number;
    }
  >();
  for (const log of logs) {
    const key = `${log.projectId}\0${log.routeId ?? ""}\0${log.providerType}\0${log.finalModelId ?? ""}`;
    const existing = buckets.get(key) ?? {
      projectId: log.projectId,
      routeId: log.routeId ?? null,
      providerType: log.providerType,
      modelId: log.finalModelId ?? null,
      requestCount: 0,
      latencyTotal: 0,
      errorCount: 0,
    };
    existing.requestCount += 1;
    existing.latencyTotal += Number.isFinite(log.latencyMs) ? log.latencyMs : 0;
    if (log.requestStatus !== "resolved") existing.errorCount += 1;
    buckets.set(key, existing);
  }
  return [...buckets.values()].map((b) => ({
    projectId: b.projectId,
    routeId: b.routeId,
    providerType: b.providerType,
    modelId: b.modelId,
    requestCount: b.requestCount,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: null,
    avgLatencyMs: b.requestCount > 0 ? Math.round(b.latencyTotal / b.requestCount) : null,
    errorRate: b.requestCount > 0 ? b.errorCount / b.requestCount : 0,
  }));
}

export const load: PageServerLoad = async ({ url, locals }) => {
  const daysParam = url.searchParams.get("days");
  const days = Math.min(
    MAX_DAYS,
    Math.max(1, parseInt(daysParam ?? String(DEFAULT_DAYS), 10) || DEFAULT_DAYS)
  );
  const until = Date.now();
  const since = until - days * 24 * 60 * 60 * 1000;
  try {
    const ctx = await getWorkspaceAndActor(locals);
    if (!ctx) {
      return {
        aggregates: [],
        recentLogs: [],
        period: { since, until },
        days,
        error: "Unauthorized" as string | null,
      };
    }
    const recentLogs = await listRequestLogs(ctx.workspaceId, { limit: 50, since, until });
    let aggregates = [];
    try {
      aggregates = await aggregateRequestLogsToUsage(ctx.workspaceId, { since, until });
    } catch (aggErr) {
      console.error("[analytics] aggregate failed; using recent-log fallback:", aggErr);
      aggregates = aggregateFromRecentLogs(recentLogs);
    }
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
