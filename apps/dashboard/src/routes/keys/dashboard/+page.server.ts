import type { PageServerLoad } from "./$types";
import {
  listProjects,
  listApiKeys,
  listProviderIntegrations,
  getOrCreateDefaultWorkspace,
  aggregateRequestLogsToUsage,
  listRoutes,
  listRequestLogs,
} from "$lib/server/db";
import { getWorkspaceEntitlements } from "$lib/server/entitlements";

function monthStartMs(now: number): number {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return {
      projects: [],
      projectsError: null,
      onboarding: null,
      entitlements: null,
      usage: null,
      setup: null,
      livePulse: null,
    };
  }
  try {
    const [workspace, projects, ent] = await Promise.all([
      getOrCreateDefaultWorkspace(locals.user.uid),
      listProjects(locals.user.uid),
      getWorkspaceEntitlements(locals),
    ]);
    let hasKeys = false;
    let totalGatewayKeys = 0;
    for (const p of projects) {
      const keys = await listApiKeys(p.id, locals.user!.uid);
      totalGatewayKeys += keys.length;
      if (keys.length > 0) {
        hasKeys = true;
      }
    }

    const integrations = await listProviderIntegrations(workspace.id);
    const hasIntegrations = integrations.length > 0;

    const routesByProject = await Promise.all(
      projects.map(async (project) => {
        const routes = await listRoutes(project.id, locals.user!.uid);
        return { projectId: project.id, routes };
      })
    );
    const allRoutes = routesByProject.flatMap((item) => item.routes);
    const routeNameById = Object.fromEntries(allRoutes.map((route) => [route.id, route.name]));

    const now = Date.now();
    const last24hSince = now - 24 * 60 * 60 * 1000;
    const allLogs24h = await listRequestLogs(workspace.id, {
      since: last24hSince,
      until: now,
      limit: 500,
    });
    const anyLogs = await listRequestLogs(workspace.id, { limit: 1 });

    let usedThisMonth: number | null = null;
    if (ent) {
      const since = monthStartMs(now);
      const until = now;
      const usage = await aggregateRequestLogsToUsage(ent.workspaceId, { since, until });
      usedThisMonth = usage.reduce((acc, r) => acc + (r.requestCount ?? 0), 0);
    }

    let analyticsUnavailable = false;
    let aggregates24h:
      | {
          routeId: string | null;
          requestCount: number;
          avgLatencyMs: number | null;
          errorRate: number | null;
        }[]
      | null = null;

    try {
      const rows = await aggregateRequestLogsToUsage(workspace.id, { since: last24hSince, until: now });
      aggregates24h = rows.map((row) => ({
        routeId: row.routeId ?? null,
        requestCount: row.requestCount,
        avgLatencyMs: row.avgLatencyMs ?? null,
        errorRate: row.errorRate ?? null,
      }));
    } catch (aggError) {
      console.error("[overview] 24h aggregate failed, using logs fallback:", aggError);
      analyticsUnavailable = true;
    }

    const sortedLatencies = [...allLogs24h]
      .map((log) => log.latencyMs)
      .filter((latency) => Number.isFinite(latency))
      .sort((a, b) => a - b);

    const percentile = (values: number[], p: number): number | null => {
      if (values.length === 0) return null;
      const index = Math.min(values.length - 1, Math.max(0, Math.ceil(p * values.length) - 1));
      return values[index] ?? null;
    };

    const fallbackByRoute = new Map<string, number>();
    for (const log of allLogs24h) {
      const key = log.routeId ?? "__no_route__";
      fallbackByRoute.set(key, (fallbackByRoute.get(key) ?? 0) + 1);
    }
    const topRouteFallback = [...fallbackByRoute.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const errorCountFallback = allLogs24h.filter(
      (log) => log.requestStatus === "no_route" || log.requestStatus === "policy_blocked"
    ).length;

    const aggregateRequestCount =
      aggregates24h?.reduce((sum, row) => sum + (row.requestCount ?? 0), 0) ?? 0;
    const aggregateWeightedError = aggregates24h?.reduce(
      (sum, row) => sum + (row.requestCount ?? 0) * (row.errorRate ?? 0),
      0
    );
    const aggregateWeightedLatency = aggregates24h?.reduce(
      (sum, row) => sum + (row.requestCount ?? 0) * (row.avgLatencyMs ?? 0),
      0
    );
    const aggregateByRoute = new Map<string, number>();
    for (const row of aggregates24h ?? []) {
      const key = row.routeId ?? "__no_route__";
      aggregateByRoute.set(key, (aggregateByRoute.get(key) ?? 0) + (row.requestCount ?? 0));
    }
    const topRouteAggregate = [...aggregateByRoute.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    const livePulse = {
      requestCount24h: analyticsUnavailable ? allLogs24h.length : aggregateRequestCount,
      errorRate:
        analyticsUnavailable
          ? allLogs24h.length > 0
            ? errorCountFallback / allLogs24h.length
            : 0
          : aggregateRequestCount > 0
            ? (aggregateWeightedError ?? 0) / aggregateRequestCount
            : 0,
      p50LatencyMs: percentile(sortedLatencies, 0.5),
      p95LatencyMs: percentile(sortedLatencies, 0.95),
      avgLatencyMs:
        analyticsUnavailable
          ? percentile(sortedLatencies, 0.5)
          : aggregateRequestCount > 0
            ? Math.round((aggregateWeightedLatency ?? 0) / aggregateRequestCount)
            : null,
      topRoute:
        (analyticsUnavailable ? topRouteFallback : topRouteAggregate)
          ? {
              routeId: (analyticsUnavailable ? topRouteFallback : topRouteAggregate)?.[0] ?? null,
              routeName:
                routeNameById[(analyticsUnavailable ? topRouteFallback : topRouteAggregate)?.[0] ?? ""] ??
                ((analyticsUnavailable ? topRouteFallback : topRouteAggregate)?.[0] === "__no_route__"
                  ? "No route matched"
                  : "Unknown route"),
              requestCount: (analyticsUnavailable ? topRouteFallback : topRouteAggregate)?.[1] ?? 0,
            }
          : null,
      analyticsUnavailable,
    };

    const projectCreatedAt = projects.length > 0 ? Math.min(...projects.map((project) => project.createdAt)) : null;
    const providerConnectedAt =
      integrations.length > 0 ? Math.min(...integrations.map((integration) => integration.createdAt)) : null;
    const routeCreatedAt = allRoutes.length > 0 ? Math.min(...allRoutes.map((route) => route.createdAt)) : null;
    const firstRequestAt =
      anyLogs.length > 0
        ? anyLogs.reduce((min, log) => (log.createdAt < min ? log.createdAt : min), anyLogs[0].createdAt)
        : null;

    return {
      projects,
      projectsError: null,
      onboarding: {
        hasProjects: projects.length > 0,
        hasKeys,
        hasIntegrations,
      },
      entitlements: ent,
      usage: ent
        ? {
            usedThisMonth,
            monthlyLimit: ent.monthlyRequestLimit,
            projectLimit: ent.projectLimit,
            providersConnected: integrations.length,
          }
        : null,
      setup: {
        workspaceCreatedAt: workspace.createdAt,
        projectCount: projects.length,
        projectCreatedAt,
        integrationCount: integrations.length,
        providerConnectedAt,
        gatewayKeyCount: totalGatewayKeys,
        routeCount: allRoutes.length,
        routeCreatedAt,
        requestCount: anyLogs.length,
        firstRequestAt,
      },
      livePulse,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[overview] load failed:", msg.slice(0, 120));
    return {
      projects: [],
      projectsError: "Unable to load projects",
      onboarding: null,
      entitlements: null,
      usage: null,
      setup: null,
      livePulse: null,
    };
  }
};
