import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  aggregateRequestLogsToUsage,
  getEstimatedCostUsdByModel,
  getRequestLogCountsByUtcDay,
  listRequestLogs,
} from "$lib/server/db";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;
const THIRTY_D_MS = 30 * 24 * 60 * 60 * 1000;

/** TODO(cost-by-model): Remove when real estimated_cost is reliably backfilled for charts. */
const MOCK_COST_BY_MODEL: { model: string; costUsd: number }[] = [
  { model: "gpt-4o", costUsd: 18.2 },
  { model: "claude-3-5-sonnet-20241022", costUsd: 14.6 },
  { model: "gpt-4o-mini", costUsd: 3.85 },
  { model: "unknown", costUsd: 0.45 },
];

export type UsageChartsPayload = {
  dailyRequests: { label: string; count: number }[];
  requestsOverTimeSource: "database" | "mock";
  costByModel: { model: string; costUsd: number }[];
  costByModelSource: "database" | "mock";
};

function buildLast30DaysDailySeries(
  untilMs: number,
  countsByDay: Map<string, number>,
): { label: string; count: number }[] {
  const endUtc = new Date(untilMs);
  const endDayStart = Date.UTC(
    endUtc.getUTCFullYear(),
    endUtc.getUTCMonth(),
    endUtc.getUTCDate(),
  );
  const out: { label: string; count: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const t = endDayStart - (29 - i) * 86400000;
    const d = new Date(t);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    out.push({ label, count: countsByDay.get(iso) ?? 0 });
  }
  return out;
}

/** TODO(requests-over-time): Remove when DB time-series path is guaranteed; used only on query failure. */
function mockDailyRequestsForChart(untilMs: number): { label: string; count: number }[] {
  const endUtc = new Date(untilMs);
  const endDayStart = Date.UTC(
    endUtc.getUTCFullYear(),
    endUtc.getUTCMonth(),
    endUtc.getUTCDate(),
  );
  const out: { label: string; count: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const t = endDayStart - (29 - i) * 86400000;
    const d = new Date(t);
    const label = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const count = Math.max(0, Math.round(8 + 12 * Math.sin(i / 4.2) + (i % 6) * 2));
    out.push({ label, count });
  }
  return out;
}

async function loadUsageCharts(workspaceId: string, chartUntil: number): Promise<UsageChartsPayload> {
  const chartSince = chartUntil - THIRTY_D_MS;
  let requestsOverTimeSource: "database" | "mock" = "database";
  let dailyRequests: { label: string; count: number }[] = [];
  try {
    const byDay = await getRequestLogCountsByUtcDay(workspaceId, chartSince, chartUntil);
    const map = new Map(byDay.map((r) => [r.day, r.count]));
    dailyRequests = buildLast30DaysDailySeries(chartUntil, map);
  } catch (e) {
    console.error("[analytics] getRequestLogCountsByUtcDay failed:", e);
    dailyRequests = mockDailyRequestsForChart(chartUntil);
    requestsOverTimeSource = "mock";
  }

  let costByModelSource: "database" | "mock" = "database";
  let costByModel: { model: string; costUsd: number }[] = [];
  try {
    costByModel = await getEstimatedCostUsdByModel(workspaceId, chartSince, chartUntil);
    if (!costByModel.some((r) => r.costUsd > 0)) {
      costByModel = MOCK_COST_BY_MODEL;
      costByModelSource = "mock";
    }
  } catch (e) {
    console.error("[analytics] getEstimatedCostUsdByModel failed:", e);
    costByModel = MOCK_COST_BY_MODEL;
    costByModelSource = "mock";
  }

  return { dailyRequests, requestsOverTimeSource, costByModel, costByModelSource };
}

function aggregateFromRecentLogs(
  logs: Array<{
    projectId: string;
    routeId: string | null;
    providerType: string;
    finalModelId: string | null;
    latencyMs: number;
    requestStatus: string;
  }>,
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
    Math.max(1, parseInt(daysParam ?? String(DEFAULT_DAYS), 10) || DEFAULT_DAYS),
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
        usageCharts: null as UsageChartsPayload | null,
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
    const usageCharts = await loadUsageCharts(ctx.workspaceId, until);
    return {
      aggregates,
      recentLogs,
      period: { since, until },
      days,
      error: null,
      usageCharts,
    };
  } catch (e) {
    console.error("[analytics] load failed:", e);
    return {
      aggregates: [],
      recentLogs: [],
      period: { since, until },
      days,
      error: "Unable to load analytics",
      usageCharts: null as UsageChartsPayload | null,
    };
  }
};
