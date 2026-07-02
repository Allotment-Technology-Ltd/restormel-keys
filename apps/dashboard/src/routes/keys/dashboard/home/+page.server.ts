/**
 * R2 — `/home`: the one Home (redesign §2.3).
 *
 * W2.6's Overview load, moved unchanged from `/activity`, plus the dissolved
 * Connect hub home's streamed panel loads (setup ledger / trust scorecard /
 * quality history) relocated mechanically — R3 ("One Home") owns the proper
 * merged masthead and will consolidate the two load groups.
 *
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
  listApiKeysByWorkspace,
} from "$lib/server/db";
import { getWorkspaceEntitlements } from "$lib/server/entitlements";
import {
  loadConnectHubPage,
  loadConnectGraphPulse,
  loadConnectTrustScorecardPanel,
  loadConnectQualityHistoryPanel,
} from "$lib/server/connect/connect-hub-load";
import { isCredentialEncryptionConfigured } from "$lib/server/credential-crypto";
import { loadConnectTrustScorecard } from "$lib/server/connect/trust-scorecard-service";
import { computeConnectVerifiedReadiness } from "$lib/server/connect/verified-readiness";
import type { ConnectReadinessStatus } from "$lib/connect/verified-readiness";
import { getGraphTargetForUi } from "$lib/server/connect/graph-target-service";
import { listConnectIngestJobsForWorkspace } from "$lib/server/neon";
import { isSignedInSession } from "$lib/server/session-user";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

/**
 * True when this instance is running in a non-production (self-host / dev) context.
 * The RESTORMEL_CREDENTIALS_ENCRYPTION_KEY banner must only appear here — cloud users
 * have no access to .env.local and seeing the message is confusing and alarming (A-P1-3).
 */
function isSelfHostOrDev(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production"
  );
}

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

/**
 * RES-113 PR-3 (flag-ON only): one row of the LIVE-state "Recent activity" panel —
 * a real gateway request attributed to the connection (gateway key) that made it.
 * Ingest traffic (`source === "connect_ingest"`) is excluded: the panel shows the
 * app/agent ASKING, not the pipeline writing (honesty, REC-ADR-016).
 */
export type HomeActivityRow = {
  id: string;
  /** Connection (gateway key) label; "Your app" when the request carries no key attribution. */
  connectionName: string;
  /** Request timestamp (ms epoch) for the "{relative time} ago" render. */
  createdAt: number;
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

export const load: PageServerLoad = async (event) => {
  const { locals } = event;
  // RES-113 PR-3: the journey Home shell (flag-ON only) needs a graph display name
  // and the LIVE-state activity rows. Both are computed ONLY when the flag is on —
  // the flag-OFF path issues the exact same queries as before (byte-identity).
  const journeyOn = Boolean((locals.moduleFlags ?? MVP_MODULE_DEFAULTS).onboardingJourney);
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
      // RES-113 PR-3 (flag-ON only; inert null on flag-OFF / signed-out).
      graphName: null as string | null,
      homeActivity: Promise.resolve(null) as Promise<HomeActivityRow[] | null>,
      hasAppTraffic24h: false,
      ...signedOutHubDefaults(),
    };
  }

  // ── Connect workspace panels (relocated from the dissolved hub home) ────
  // Per-request stats memo (F6): loadConnectGraphPulse and
  // loadConnectTrustScorecardPanel share one resolveConnectGraphStats call.
  if (!event.locals.connectStatsRequestMemo) {
    event.locals.connectStatsRequestMemo = new Map();
  }
  const signedInForHub = isSignedInSession(locals);
  const hubPanels = signedInForHub
    ? {
        hubSignedIn: true,
        encryptionWarning: isSelfHostOrDev() && !isCredentialEncryptionConfigured(),
        hub: loadConnectHubPage(event),
        graphPulse: loadConnectGraphPulse(event),
        scorecard: loadConnectTrustScorecardPanel(event),
        qualityHistory: loadConnectQualityHistoryPanel(event),
      }
    : signedOutHubDefaults();

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

    // RES-113 PR-3 (flag-ON only): the LIVE-state activity rows — the most recent
    // gateway requests attributed to their connection (gateway key) names. Streamed;
    // resolves to null on failure (the shell renders its error state with a retry).
    // Ingest traffic is excluded AT THE QUERY (`excludeSource`) — the panel shows
    // the app ASKING, never the pipeline writing, and a big ingest run (one log per
    // resolve) can never evict genuine app asks from the LIMIT window (5-lens
    // review fix). The in-JS filter stays as defense in depth for any legacy row
    // the SQL predicate cannot see. Flag-OFF: no queries issued, resolves null.
    const homeActivityPromise: Promise<HomeActivityRow[] | null> = journeyOn
      ? (async () => {
          const [logs, keys] = await Promise.all([
            listRequestLogs(wsId, { limit: 25, excludeSource: "connect_ingest" }),
            listApiKeysByWorkspace(wsId).catch(() => []),
          ]);
          const nameByKeyId = new Map(keys.map((k) => [k.id, k.label ?? k.keyPrefix]));
          return logs
            .filter((l) => l.source !== "connect_ingest")
            .slice(0, 5)
            .map((l) => ({
              id: l.id,
              connectionName:
                (l.gatewayKeyId ? nameByKeyId.get(l.gatewayKeyId) : null) ?? "Your app",
              createdAt: l.createdAt,
            }));
        })().catch(() => null)
      : Promise.resolve(null);

    // RES-113 PR-3 (flag-ON only): the hero chip's traffic signal. `LIVE` renders
    // only from real APP traffic — the pipeline's own `connect_ingest` request
    // logs are excluded, so a rebuild can never fabricate "Live — serving answers
    // to your app" (copy pack §1 honesty rule / REC-ADR-016; 5-lens review fix).
    // An existence probe (limit 1), not a count — the chip only needs "any".
    // Flag-OFF: no query issued, false (inert — never read).
    const hasAppTraffic24hPromise: Promise<boolean> = journeyOn
      ? listRequestLogs(wsId, {
          since: last24hSince,
          until: now,
          limit: 1,
          excludeSource: "connect_ingest",
        })
          .then((logs) => logs.some((l) => l.source !== "connect_ingest"))
          .catch(() => false)
      : Promise.resolve(false);

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
    // Already .catch-guarded to false; started in parallel with livePulse above.
    const hasAppTraffic24h = await hasAppTraffic24hPromise;

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
      // RES-113 PR-3 (flag-ON only): graph display name for the persistent hero.
      // The graph target's label is the closest real user-facing graph name today;
      // null (⇒ the shell renders "Your graph") when absent — never fabricated.
      graphName: journeyOn ? (target?.label ?? null) : null,
      homeActivity: homeActivityPromise,
      // RES-113 PR-3 (flag-ON only): ingest-excluded 24h traffic signal for the
      // hero chip — the SAME filtered source the activity rows use, so the chip
      // and the panel below it can never contradict each other.
      hasAppTraffic24h,
      ...hubPanels,
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
      graphName: null as string | null,
      homeActivity: Promise.resolve(null) as Promise<HomeActivityRow[] | null>,
      hasAppTraffic24h: false,
      ...hubPanels,
    };
  }
};

function signedOutHubDefaults() {
  return {
    hubSignedIn: false,
    encryptionWarning: false,
    hub: Promise.resolve(null) as ReturnType<typeof loadConnectHubPage>,
    graphPulse: Promise.resolve(null) as ReturnType<typeof loadConnectGraphPulse>,
    scorecard: Promise.resolve(null) as ReturnType<typeof loadConnectTrustScorecardPanel>,
    qualityHistory: Promise.resolve([]) as ReturnType<typeof loadConnectQualityHistoryPanel>,
  };
}
