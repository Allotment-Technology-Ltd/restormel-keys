import type { ServerLoadEvent } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  buildConnectOperationalActions,
  buildConnectSetupSteps,
  resolveConnectJourneyPhase,
  resolveNextSetupStep,
  type ConnectSetupStepId,
} from "$lib/connect/connect-journey";
import { getGraphTargetForUi } from "$lib/server/connect/graph-target-service";
import { listConnectIngestJobsForWorkspace } from "$lib/server/neon";
import {
  peekConnectGraphStatsForView,
  resolveConnectGraphStats,
  type ConnectGraphStatsView,
  type ConnectStatsRequestMemo,
} from "$lib/server/connect/graph-explorer-service";
import { listDomainPacksForUi } from "$lib/server/connect/domain-pack-service";
import { listSourceDocuments } from "$lib/server/connect/source-documents";
import { listConnections } from "$lib/server/connect/connections-service";
import { isLlmConfigured } from "$lib/server/connect/llm-generate";
import { isCredentialEncryptionConfigured } from "$lib/server/credential-crypto";
import { computeConnectModelsReady } from "$lib/server/connect/stage-routing";
import { listStarterCorpusDocuments } from "$lib/server/connect/starter-corpus";
import { graphStatsToHealthSummary } from "$lib/server/connect/kg-audit-summary";
import { loadConnectTrustScorecard } from "$lib/server/connect/trust-scorecard-service";
import type { ConnectTrustScorecard, ConnectEvalVerdictEntry } from "@restormel/contracts";
import { listProviderIntegrations } from "$lib/server/db";
import { listConnectEvalVerdicts } from "$lib/server/neon";
import { perfSpan } from "$lib/debug/server-perf";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import {
  getRoutingProjectLedgerRow,
  type RoutingProjectLedgerRow,
} from "$lib/server/connect/workspace-infrastructure";

export type ConnectHubPayload = {
  phase: "initial" | "operational";
  journey: {
    steps: ReturnType<typeof buildConnectSetupSteps>;
    completed: number;
    total: number;
    nextStepId: ConnectSetupStepId | null;
    latestJob: {
      id: string;
      status: string;
      label?: string | null;
      currentStage?: string | null;
      updatedAt: string;
    } | null;
    stats: Awaited<ReturnType<typeof resolveConnectGraphStats>>;
    flags: { llmReady: boolean; encryptionReady: boolean };
  };
  operationalActions: ReturnType<typeof buildConnectOperationalActions> | null;
  setupHealth: {
    graphStore: boolean;
    routesReady: boolean;
    encryptionReady: boolean;
    documentsReady: boolean;
    productionPresetDefault: boolean;
    graphHealth: ReturnType<typeof graphStatsToHealthSummary> | null;
  };
  agentReady: boolean;
  surrealStoreReady: boolean;
  /**
   * R7 (D4): the named routing project + change affordance ("Routing project:
   * Workspace infrastructure — change") for the readiness ledger / Home masthead
   * (R3) to render. Null when the row could not be computed — never blocks the hub.
   */
  routingProject: RoutingProjectLedgerRow | null;
};

export async function loadConnectHubPage(
  event: Pick<ServerLoadEvent, "locals" | "depends" | "parent">,
): Promise<ConnectHubPayload | null> {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return null;
  }
  try {
    const endHub = perfSpan("connect/hub", "loadConnectHubPage");
    const workspace = await requireConnectWorkspace(
      event.locals,
      event.parent as () => Promise<{ connectWorkspace: { id: string; userId: string } | null }>,
    );
    const wsId = workspace.id;
    event.depends(`app:connect-hub:${wsId}`);
    const userId = event.locals.user.uid;

    const endParallel = perfSpan("connect/hub", "parallelQueries");
    const [target, packs, documents, connections, jobs, integrations, statsResult, starterDocs, routingProject] =
      await Promise.all([
        getGraphTargetForUi(wsId),
        listDomainPacksForUi(wsId),
        listSourceDocuments(wsId),
        listConnections(wsId),
        listConnectIngestJobsForWorkspace({ workspaceId: wsId }),
        listProviderIntegrations(wsId).catch(() => []),
        // Cached stats or a fast unit count — full aggregates stream via graphPulse.
        peekConnectGraphStatsForView(wsId).catch(() => null),
        listStarterCorpusDocuments(wsId),
        // R7 ledger row: "Routing project: <name> — change". Best-effort.
        getRoutingProjectLedgerRow({ workspaceId: wsId, userId, dashboardBase: DASHBOARD_BASE }).catch(
          () => null,
        ),
      ]);
    endParallel();
    const stats = statsResult?.stats ?? null;

    const llmReady = isLlmConfigured();
    const modelsStatus = await computeConnectModelsReady({
      workspaceId: wsId,
      userId,
      integrationsCount: integrations.length,
      llmReady,
      dashboardBase: DASHBOARD_BASE,
    });
    const encryptionReady = isCredentialEncryptionConfigured();
    const customPack = packs.find((p) => !p.is_builtin) ?? null;
    const parsedDocs = documents.filter((d) => d.status === "parsed");
    const starterCorpusLoaded = starterDocs.filter((d) => d.status === "parsed").length >= 3;
    const surrealStoreReady = Boolean(target?.provider === "surreal" && target.status === "ok");
    const neonStoreReady = Boolean(target?.provider === "postgres" && target.status === "ok");
    const hasGraph = Boolean(stats && stats.units > 0);

    const latestJob = jobs[0]
      ? {
          id: jobs[0].id,
          status: jobs[0].status,
          label: jobs[0].label,
          currentStage: jobs[0].currentStage,
          updatedAt: new Date(jobs[0].updatedAt).toISOString(),
        }
      : null;

    const aiKeysDetail = modelsStatus.modelsReady
      ? "Chat and embedding routes configured"
      : !modelsStatus.hasChatRoute && !modelsStatus.hasEmbeddingRoute
        ? integrations.length > 0
          ? `${integrations.length} connection(s) — add chat and embedding ingestion routes`
          : llmReady
            ? "Hosted model available — add Connections and publish ingestion routes"
            : "Add provider keys, then publish chat and embedding routes"
        : !modelsStatus.hasChatRoute
          ? "Embedding route ready — add a published chat route (extraction stage)"
          : "Chat route ready — add a published embedding route";

    const phase = resolveConnectJourneyPhase({
      hasGraphStore: Boolean(target),
      modelsReady: modelsStatus.modelsReady,
      parsedDocumentCount: parsedDocs.length,
    });

    const steps = buildConnectSetupSteps({
      target,
      modelsReady: modelsStatus.modelsReady,
      aiKeysDetail,
      customPack,
      parsedDocumentCount: parsedDocs.length,
      starterCorpusLoaded,
      connectionCount: connections.length,
      jobCount: jobs.length,
      latestJob,
      hasGraph,
      surrealStoreReady,
      neonStoreReady,
    });

    const nextStep = resolveNextSetupStep(steps);
    const completed = steps.filter((s) => s.status === "done").length;

    const operationalActions =
      phase === "operational"
        ? buildConnectOperationalActions({
            latestJob,
            hasGraph,
            surrealStoreReady,
            modelsReady: modelsStatus.modelsReady,
          })
        : null;

    const agentReady = surrealStoreReady && modelsStatus.modelsReady && hasGraph;
    const graphHealth = stats ? graphStatsToHealthSummary(stats) : null;

    const payload = {
      phase,
      journey: {
        steps,
        completed,
        total: steps.length,
        nextStepId: nextStep?.id ?? null,
        latestJob,
        stats,
        flags: { llmReady, encryptionReady },
      },
      operationalActions,
      setupHealth: {
        graphStore: Boolean(target && target.status === "ok"),
        routesReady: modelsStatus.modelsReady,
        encryptionReady,
        documentsReady: parsedDocs.length > 0,
        productionPresetDefault: true,
        graphHealth,
      },
      agentReady,
      surrealStoreReady,
      routingProject,
    };
    endHub();
    return payload;
  } catch (e) {
    // null renders the hub's signed-out notice — log why so a backend failure
    // (e.g. schema-gate or store error) is never silently misread as "not logged in".
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[connect-hub] loadConnectHubPage failed (rendering signed-out state):", msg.slice(0, 300));
    return null;
  }
}

export type ConnectGraphPulse = {
  stats: ConnectGraphStatsView | null;
  graphHealth: ReturnType<typeof graphStatsToHealthSummary> | null;
  /**
   * W2.3: trust score from the scorecard service (single source of truth).
   * The pulse band QUOTES this value instead of recomputing from graphHealth.
   * Null when the scorecard could not be loaded (no graph yet, or store error).
   */
  scorecardTrustScore: number | null;
  /**
   * W2.3: the formula footnote from the scorecard, for the "powered by" tooltip.
   * Null when scorecardTrustScore is null.
   */
  trustFormula: string | null;
};

/**
 * Authoritative graph stats + scorecard trust score for the pulse band.
 * Recomputes the full aggregates (relations, groups, embedded, validation)
 * when the cache is cold/stale. Streamed separately from the hub shell.
 *
 * Per-request deduplication (F6): reads the shared stats memo from event.locals so
 * this call and the concurrent scorecard load share one resolution promise.
 *
 * W2.3: the scorecard service is the single source of trust score truth — the
 * pulse band quotes the scorecard value, never recomputes it independently.
 */
export async function loadConnectGraphPulse(
  event: Pick<ServerLoadEvent, "locals" | "parent">,
): Promise<ConnectGraphPulse | null> {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return null;
  }
  try {
    const workspace = await requireConnectWorkspace(
      event.locals,
      event.parent as () => Promise<{ connectWorkspace: { id: string; userId: string } | null }>,
    );
    const requestMemo = event.locals.connectStatsRequestMemo as ConnectStatsRequestMemo | undefined;
    // Both stats and scorecard share the requestMemo — one store scan.
    const [stats, scorecard] = await Promise.all([
      resolveConnectGraphStats(workspace.id, { requestMemo }).catch(() => null),
      loadConnectTrustScorecard(workspace.id, { requestMemo }).catch(() => null),
    ]);
    const graphHealth = stats ? graphStatsToHealthSummary(stats) : null;
    return {
      stats,
      graphHealth,
      scorecardTrustScore: scorecard?.trust_score ?? null,
      trustFormula: scorecard?.trust_formula ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[connect-hub] loadConnectGraphPulse failed:", msg.slice(0, 300));
    return null;
  }
}

/**
 * Streamed trust scorecard for the hub panel (Stage 1.2). Resolves null when signed
 * out or the graph has no units yet (panel empty state); REJECTS on workspace/store
 * read failures so the panel can render its error state with a recovery action —
 * unlike the pulse, a failure here must not masquerade as "no graph yet".
 *
 * Per-request deduplication (F6): passes the shared stats memo from event.locals so
 * the scorecard reuses the same stats resolution as the concurrent pulse load.
 */
export async function loadConnectTrustScorecardPanel(
  event: Pick<ServerLoadEvent, "locals" | "parent">,
): Promise<ConnectTrustScorecard | null> {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return null;
  }
  const workspace = await requireConnectWorkspace(
    event.locals,
    event.parent as () => Promise<{ connectWorkspace: { id: string; userId: string } | null }>,
  );
  const requestMemo = event.locals.connectStatsRequestMemo as ConnectStatsRequestMemo | undefined;
  return loadConnectTrustScorecard(workspace.id, { requestMemo });
}

/**
 * Streamed quality-history panel for the Connect hub (Stage 2.4). Returns the 25
 * most recent persisted eval verdicts, newest first. Resolves to an empty array
 * when signed out or no verdicts have been recorded yet. REJECTS on storage errors
 * so the panel can render its error state with a recovery action.
 */
export async function loadConnectQualityHistoryPanel(
  event: Pick<ServerLoadEvent, "locals" | "parent">,
): Promise<ConnectEvalVerdictEntry[]> {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return [];
  }
  const workspace = await requireConnectWorkspace(
    event.locals,
    event.parent as () => Promise<{ connectWorkspace: { id: string; userId: string } | null }>,
  );
  const rows = await listConnectEvalVerdicts({ workspaceId: workspace.id, limit: 25 });
  return rows.map((row) => ({
    id: row.id,
    workspace_id: row.workspaceId,
    recorded_at: row.recordedAt,
    source: row.source as ConnectEvalVerdictEntry["source"],
    verdict: row.verdict as ConnectEvalVerdictEntry["verdict"],
    diff: (row.diff as ConnectEvalVerdictEntry["diff"]) ?? null,
    // W3.4 handoff: cross-link quality-history rows back to their producing run console.
    source_run_id: row.sourceRunId ?? null,
  }));
}
