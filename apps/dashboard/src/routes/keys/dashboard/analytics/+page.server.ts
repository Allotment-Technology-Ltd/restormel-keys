import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import {
  aggregateRequestLogsToUsage,
  getEstimatedCostUsdByModel,
  getProjectInWorkspace,
  getRequestLogCountsByUtcDay,
  listProjects,
  listProjectsByWorkspace,
  listRequestLogs,
} from "$lib/server/db";
import { loadVerificationEconomicsByCorpus } from "$lib/server/connect/verification-economics-source";
import type { RunVerificationEconomics } from "$lib/connect/verification-economics";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;
const THIRTY_D_MS = 30 * 24 * 60 * 60 * 1000;

/** TODO(cost-by-model): Remove when real estimated_cost is reliably backfilled for charts. */
const MOCK_COST_BY_MODEL: { model: string; costUsd: number }[] = [
  { model: "gpt-4o", costUsd: 18.2 },
  { model: "claude-sonnet-4", costUsd: 14.6 },
  { model: "gpt-4o-mini", costUsd: 3.85 },
  { model: "unknown", costUsd: 0.45 },
];

function useAnalyticsMockFallback(): boolean {
  return process.env.RESTORMEL_ANALYTICS_USE_MOCK_FALLBACK !== "false";
}

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

async function loadUsageCharts(
  workspaceId: string,
  chartUntil: number,
  projectId: string | null,
  allowMockFallback: boolean,
): Promise<UsageChartsPayload> {
  const chartSince = chartUntil - THIRTY_D_MS;
  let requestsOverTimeSource: "database" | "mock" = "database";
  let dailyRequests: { label: string; count: number }[] = [];
  try {
    const byDay = await getRequestLogCountsByUtcDay(workspaceId, chartSince, chartUntil, projectId);
    const map = new Map(byDay.map((r) => [r.day, r.count]));
    dailyRequests = buildLast30DaysDailySeries(chartUntil, map);
  } catch (e) {
    console.error("[analytics] getRequestLogCountsByUtcDay failed:", e);
    if (allowMockFallback) {
      dailyRequests = mockDailyRequestsForChart(chartUntil);
      requestsOverTimeSource = "mock";
    } else {
      dailyRequests = buildLast30DaysDailySeries(chartUntil, new Map());
      requestsOverTimeSource = "database";
    }
  }

  let costByModelSource: "database" | "mock" = "database";
  let costByModel: { model: string; costUsd: number }[] = [];
  try {
    costByModel = await getEstimatedCostUsdByModel(workspaceId, chartSince, chartUntil, 12, projectId);
    if (!costByModel.some((r) => r.costUsd > 0)) {
      if (allowMockFallback) {
        costByModel = MOCK_COST_BY_MODEL;
        costByModelSource = "mock";
      } else {
        costByModel = [];
        costByModelSource = "database";
      }
    }
  } catch (e) {
    console.error("[analytics] getEstimatedCostUsdByModel failed:", e);
    if (allowMockFallback) {
      costByModel = MOCK_COST_BY_MODEL;
      costByModelSource = "mock";
    } else {
      costByModel = [];
      costByModelSource = "database";
    }
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
  projectId: string | null,
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
    if (projectId && log.projectId !== projectId) continue;
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
        projectId: null as string | null,
        projects: [] as { id: string; name: string }[],
        error: "Unauthorized" as string | null,
        usageCharts: null as UsageChartsPayload | null,
        verificationEconomics: null as RunVerificationEconomics[] | null,
      };
    }

    let projectId: string | null = url.searchParams.get("projectId")?.trim() || null;
    if (projectId) {
      const proj = await getProjectInWorkspace(projectId, ctx.workspaceId);
      if (!proj) projectId = null;
    }

    const projects =
      ctx.actorType === "user"
        ? await listProjects(ctx.actorId)
        : await listProjectsByWorkspace(ctx.workspaceId);

    const recentLogs = await listRequestLogs(ctx.workspaceId, {
      limit: 50,
      since,
      until,
      projectId: projectId ?? undefined,
    });
    let aggregates = [];
    try {
      aggregates = await aggregateRequestLogsToUsage(ctx.workspaceId, {
        since,
        until,
        projectId: projectId ?? undefined,
      });
    } catch (aggErr) {
      console.error("[analytics] aggregate failed; using recent-log fallback:", aggErr);
      aggregates = aggregateFromRecentLogs(recentLogs, projectId);
    }
    const usageCharts = await loadUsageCharts(
      ctx.workspaceId,
      until,
      projectId,
      useAnalyticsMockFallback(),
    );
    // RES-113 PR-8 (copy pack §2.8): verification-economics rows are fetched ONLY
    // behind the m1PlugPoints flag — flag OFF, the load path and payload render
    // byte-identically (`null`, nothing rendered).
    const verificationEconomics = locals.moduleFlags?.m1PlugPoints
      ? await loadVerificationEconomicsByCorpus({
          workspaceId: ctx.workspaceId,
          sinceMs: since,
          untilMs: until,
          projectId,
        }).catch(() => [] as RunVerificationEconomics[])
      : null;
    return {
      aggregates,
      recentLogs,
      period: { since, until },
      days,
      projectId,
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
      error: null,
      usageCharts,
      verificationEconomics,
    };
  } catch (e) {
    console.error("[analytics] load failed:", e);
    return {
      aggregates: [],
      recentLogs: [],
      period: { since, until },
      days,
      projectId: null as string | null,
      projects: [] as { id: string; name: string }[],
      error: "Unable to load analytics",
      usageCharts: null as UsageChartsPayload | null,
      verificationEconomics: null as RunVerificationEconomics[] | null,
    };
  }
};
