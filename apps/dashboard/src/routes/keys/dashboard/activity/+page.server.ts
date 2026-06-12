/**
 * W2.6 — Overview becomes the verified-context home.
 *
 * Resolves UX IA-3 (two competing homes) and FUNC P2-1 (sequential waterfall).
 *
 * Changes vs the prior version:
 *  - Promise.all for all independent queries (workspace / keys / integrations /
 *    policy-bindings / routes / jobs / target in one group; logs + aggregates in
 *    another via SvelteKit streaming so the shell paints before the heavy queries).
 *  - trustStrip: streamed ConnectTrustScorecard | null (peek mode — never blocks
 *    the shell; the Overview quotes the scorecard service, never recomputes).
 *  - connectCompletion: the four Connect-journey milestone booleans derived from
 *    data already fetched, per the Stage 1.8 "no new queries" invariant.
 *
 * Claims-ledger citations (roadmap §7):
 *  - Trust strip copy "supported claims" → row 2 (every supported claim backed by
 *    a verbatim quote) and row 1 (validated against source).
 *  - "Review claims" milestone → row 10 (uncertainty goes to human review).
 */
import type { PageServerLoad } from "./$types";
import {
  listProjects,
  countApiKeysByWorkspace,
  listProviderIntegrations,
  getOrCreateDefaultWorkspace,
  aggregateRequestLogsToUsage,
  listRoutes,
  listRequestLogs,
  listPolicyBindingsForWorkspace,
} from "$lib/server/db";
import { getWorkspaceEntitlements } from "$lib/server/entitlements";
import { loadConnectTrustScorecard } from "$lib/server/connect/trust-scorecard-service";
import { computeConnectVerifiedReadiness } from "$lib/server/connect/verified-readiness";
import type { ConnectReadinessStatus } from "$lib/connect/verified-readiness";
import { getGraphTargetForUi } from "$lib/server/connect/graph-target-service";
import { listConnectIngestJobsForWorkspace } from "$lib/server/neon";

function monthStartMs(now: number): number {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * The four Connect-journey milestones shown in the Overview checklist.
 * Derived from data already fetched — no extra queries (Stage 1.8 invariant).
 */
/** K4: the Overview's Connect chip quotes the shared readiness ledger summary. */
export type ConnectReadinessSummary = {
  ready: number;
  total: number;
  status: ConnectReadinessStatus;
};

export type ConnectCompletionSignals = {
  /** A graph store has been connected (Neon or SurrealDB). */
  storeConnected: boolean;
  /** At least one ingest run has been started. */
  firstRunStarted: boolean;
  /** At least one completed ingest run exists (graph has been built). */
  firstRunCompleted: boolean;
  /** Graph has units AND at least one source connection was wired. */
  agentReady: boolean;
};

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return {
      projects: [],
      projectsError: null,
      workspaceId: null as string | null,
      onboarding: null,
      entitlements: null,
      usage: null,
      setup: null,
      livePulse: null,
      contextSignals: {
        noRouteCount24h: 0,
        hasAnyRoutePolicyBinding: true,
      },
      connectCompletion: {
        storeConnected: false,
        firstRunStarted: false,
        firstRunCompleted: false,
        agentReady: false,
      } as ConnectCompletionSignals,
      // Streamed — null until resolved; page renders without it.
      trustStrip: Promise.resolve(null) as Promise<import("@restormel/contracts").ConnectTrustScorecard | null>,
      connectReadiness: Promise.resolve(null) as Promise<ConnectReadinessSummary | null>,
    };
  }

  try {
    const now = Date.now();
    const last24hSince = now - 24 * 60 * 60 * 1000;

    // ── Group 1: Fast parallel core data ──────────────────────────────────
    // Workspace + keys + integrations + policy-bindings + routes + jobs + target
    // run in one Promise.all. (routes still N+1 per project, same as before; a
    // future stage may flatten — keeping the surface small here.)
    const [workspace, projects, ent] = await Promise.all([
      getOrCreateDefaultWorkspace(locals.user.uid),
      listProjects(locals.user.uid),
      getWorkspaceEntitlements(locals),
    ]);

    const wsId = workspace.id;

    const [totalGatewayKeys, integrations, policyBindings, target, recentJobs] = await Promise.all([
      countApiKeysByWorkspace(wsId),
      listProviderIntegrations(wsId),
      listPolicyBindingsForWorkspace(wsId),
      getGraphTargetForUi(wsId).catch(() => null),
      listConnectIngestJobsForWorkspace({ workspaceId: wsId, limit: 1 }).catch(() => []),
    ]);

    const hasAnyRoutePolicyBinding = policyBindings.some((b) => b.targetType === "route");
    const hasIntegrations = integrations.length > 0;
    const hasKeys = totalGatewayKeys > 0;

    // N+1 per project — acceptable at current project counts; W3.1 can flatten.
    const routesByProject = await Promise.all(
      projects.map(async (project) => {
        const routes = await listRoutes(project.id, locals.user!.uid);
        return { projectId: project.id, routes };
      })
    );
    const allRoutes = routesByProject.flatMap((item) => item.routes);
    const routeNameById = Object.fromEntries(allRoutes.map((r) => [r.id, r.name]));

    const anyLogs = await listRequestLogs(wsId, { limit: 1 });

    // ── Setup snapshot (for the routing checklist) ─────────────────────────
    const projectCreatedAt = projects.length > 0
      ? Math.min(...projects.map((p) => p.createdAt))
      : null;
    const providerConnectedAt = integrations.length > 0
      ? Math.min(...integrations.map((i) => i.createdAt))
      : null;
    const routeCreatedAt = allRoutes.length > 0
      ? Math.min(...allRoutes.map((r) => r.createdAt))
      : null;
    const firstRequestAt = anyLogs.length > 0
      ? anyLogs.reduce((min, l) => (l.createdAt < min ? l.createdAt : min), anyLogs[0].createdAt)
      : null;

    // ── Connect journey completion (no new queries) ─────────────────────────
    // Derived from data fetched above per the Stage 1.8 invariant.
    const latestJob = recentJobs[0] ?? null;
    const connectCompletion: ConnectCompletionSignals = {
      storeConnected: Boolean(target && target.status === "ok"),
      firstRunStarted: Boolean(latestJob),
      firstRunCompleted: Boolean(latestJob && latestJob.status === "completed"),
      agentReady: Boolean(
        target &&
        target.status === "ok" &&
        latestJob &&
        latestJob.status === "completed",
      ),
    };

    // ── Group 2: Slow queries — streamed ──────────────────────────────────
    // livePulse (logs + aggregates) and trustStrip (graph stats) are returned as
    // streaming promises so the shell and checklist paint immediately.

    const livePulsePromise = (async () => {
      const [allLogs24h, aggregatesResult, usedThisMonth] = await Promise.all([
        listRequestLogs(wsId, { since: last24hSince, until: now, limit: 500 }),
        aggregateRequestLogsToUsage(wsId, { since: last24hSince, until: now }).catch(() => null),
        ent
          ? aggregateRequestLogsToUsage(ent.workspaceId, {
              since: monthStartMs(now),
              until: now,
            }).then((rows) => rows.reduce((acc, r) => acc + (r.requestCount ?? 0), 0))
          : Promise.resolve(null),
      ]);

      const analyticsUnavailable = aggregatesResult === null;
      const aggregates24h = aggregatesResult
        ? aggregatesResult.map((row) => ({
            routeId: row.routeId ?? null,
            requestCount: row.requestCount,
            avgLatencyMs: row.avgLatencyMs ?? null,
            errorRate: row.errorRate ?? null,
          }))
        : null;

      const sortedLatencies = [...allLogs24h]
        .map((l) => l.latencyMs)
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b);

      const percentile = (values: number[], p: number): number | null => {
        if (values.length === 0) return null;
        return values[Math.min(values.length - 1, Math.max(0, Math.ceil(p * values.length) - 1))] ?? null;
      };

      const aggregateRequestCount = aggregates24h?.reduce((s, r) => s + (r.requestCount ?? 0), 0) ?? 0;
      const aggregateWeightedError = aggregates24h?.reduce(
        (s, r) => s + (r.requestCount ?? 0) * (r.errorRate ?? 0),
        0,
      );
      const aggregateWeightedLatency = aggregates24h?.reduce(
        (s, r) => s + (r.requestCount ?? 0) * (r.avgLatencyMs ?? 0),
        0,
      );

      const fallbackByRoute = new Map<string, number>();
      for (const log of allLogs24h) {
        const key = log.routeId ?? "__no_route__";
        fallbackByRoute.set(key, (fallbackByRoute.get(key) ?? 0) + 1);
      }
      const topRouteFallback = [...fallbackByRoute.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
      const errorCountFallback = allLogs24h.filter(
        (l) => l.requestStatus === "no_route" || l.requestStatus === "policy_blocked",
      ).length;

      const aggregateByRoute = new Map<string, number>();
      for (const row of aggregates24h ?? []) {
        const key = row.routeId ?? "__no_route__";
        aggregateByRoute.set(key, (aggregateByRoute.get(key) ?? 0) + (row.requestCount ?? 0));
      }
      const topRouteAggregate = [...aggregateByRoute.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

      const winner = analyticsUnavailable ? topRouteFallback : topRouteAggregate;
      const noRouteCount24h = allLogs24h.filter((l) => l.requestStatus === "no_route").length;

      return {
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
        topRoute: winner
          ? {
              routeId: winner[0] ?? null,
              routeName:
                routeNameById[winner[0] ?? ""] ??
                (winner[0] === "__no_route__" ? "No route matched" : "Unknown route"),
              requestCount: winner[1] ?? 0,
            }
          : null,
        analyticsUnavailable,
        noRouteCount24h,
        usedThisMonth: usedThisMonth ?? null,
      };
    })();

    // Trust strip: peek only — never blocks the page shell (statsMode: "peek").
    // The Overview QUOTES the scorecard service score; it never recomputes.
    // A test in activity.test.ts asserts no second formula exists here.
    const trustStripPromise = loadConnectTrustScorecard(wsId, {
      statsMode: "peek",
    }).catch(() => null);

    // K4: Connect readiness summary chip — streamed; the Overview QUOTES the
    // shared readiness ledger (review §3), it never recomputes its own model.
    const connectReadinessPromise = computeConnectVerifiedReadiness({
      workspaceId: wsId,
      userId: locals.user.uid,
      prefetched: {
        integrations,
        graphStoreReady: Boolean(target && target.status === "ok"),
      },
    })
      .then((r) => ({ ready: r.ready, total: r.total, status: r.status }))
      .catch(() => null);

    const livePulse = await livePulsePromise.catch((err) => {
      console.error("[overview] livePulse failed:", String(err).slice(0, 120));
      return null;
    });

    const noRouteCount24h = livePulse?.noRouteCount24h ?? 0;
    const usedThisMonth = livePulse?.usedThisMonth ?? null;
    const livePulseOut = livePulse
      ? {
          requestCount24h: livePulse.requestCount24h,
          errorRate: livePulse.errorRate,
          p50LatencyMs: livePulse.p50LatencyMs,
          p95LatencyMs: livePulse.p95LatencyMs,
          avgLatencyMs: livePulse.avgLatencyMs,
          topRoute: livePulse.topRoute,
          analyticsUnavailable: livePulse.analyticsUnavailable,
        }
      : null;

    return {
      projects,
      projectsError: null,
      workspaceId: wsId,
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
      livePulse: livePulseOut,
      contextSignals: {
        noRouteCount24h,
        hasAnyRoutePolicyBinding,
      },
      connectCompletion,
      // Streamed — the trust strip renders once this resolves; page shell does not wait.
      trustStrip: trustStripPromise,
      // Streamed — K4 readiness summary chip for the Verified context journey section.
      connectReadiness: connectReadinessPromise,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[overview] load failed:", msg.slice(0, 120));
    return {
      projects: [],
      projectsError: "Unable to load workspace data",
      workspaceId: null,
      onboarding: null,
      entitlements: null,
      usage: null,
      setup: null,
      livePulse: null,
      contextSignals: {
        noRouteCount24h: 0,
        hasAnyRoutePolicyBinding: true,
      },
      connectCompletion: {
        storeConnected: false,
        firstRunStarted: false,
        firstRunCompleted: false,
        agentReady: false,
      } as ConnectCompletionSignals,
      trustStrip: Promise.resolve(null),
      connectReadiness: Promise.resolve(null) as Promise<ConnectReadinessSummary | null>,
    };
  }
};
