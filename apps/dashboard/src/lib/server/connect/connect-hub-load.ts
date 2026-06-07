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
} from "$lib/server/connect/graph-explorer-service";
import { listDomainPacksForUi } from "$lib/server/connect/domain-pack-service";
import { listSourceDocuments } from "$lib/server/connect/source-documents";
import { listConnections } from "$lib/server/connect/connections-service";
import { isLlmConfigured } from "$lib/server/connect/llm-generate";
import { isCredentialEncryptionConfigured } from "$lib/server/credential-crypto";
import { computeConnectModelsReady } from "$lib/server/connect/stage-routing";
import { listStarterCorpusDocuments } from "$lib/server/connect/starter-corpus";
import { graphStatsToHealthSummary } from "$lib/server/connect/kg-audit-summary";
import { listProviderIntegrations } from "$lib/server/db";
import { perfSpan } from "$lib/debug/server-perf";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";

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
    const [target, packs, documents, connections, jobs, integrations, statsResult, starterDocs] =
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
    };
    endHub();
    return payload;
  } catch {
    return null;
  }
}

export type ConnectGraphPulse = {
  stats: ConnectGraphStatsView | null;
  graphHealth: ReturnType<typeof graphStatsToHealthSummary> | null;
};

/**
 * Authoritative graph stats for the pulse band — recomputes the full aggregates
 * (relations, groups, embedded, validation) when the cache is cold/stale. Streamed
 * separately from the hub shell, which shows the fast unit-count skeleton meanwhile.
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
    const stats = await resolveConnectGraphStats(workspace.id).catch(() => null);
    const graphHealth = stats ? graphStatsToHealthSummary(stats) : null;
    return { stats, graphHealth };
  } catch {
    return null;
  }
}
