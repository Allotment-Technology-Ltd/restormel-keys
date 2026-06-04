import type { PageServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { pipelineWizardHref, withWizardReturn } from "$lib/connect/pipeline-config";
import { getOrCreateDefaultWorkspace, listProviderIntegrations } from "$lib/server/db";
import { getGraphTargetForUi } from "$lib/server/connect/graph-target-service";
import { loadConnectGraphView } from "$lib/server/connect/graph-explorer-service";
import { listConnectIngestJobsForWorkspace } from "$lib/server/neon";
import { listDomainPacksForUi } from "$lib/server/connect/domain-pack-service";
import { listSourceDocuments } from "$lib/server/connect/source-documents";
import { listConnections } from "$lib/server/connect/connections-service";
import { isLlmConfigured } from "$lib/server/connect/llm-generate";
import { isCredentialEncryptionConfigured } from "$lib/server/credential-crypto";
import { computeConnectModelsReady } from "$lib/server/connect/stage-routing";
import { listStarterCorpusDocuments } from "$lib/server/connect/starter-corpus";

const K = DASHBOARD_BASE + "/connect";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.authType !== "session") {
    return { journey: null, firstGraphGuide: null };
  }
  try {
    const workspace = await getOrCreateDefaultWorkspace(locals.user.uid);
    const wsId = workspace.id;
    const userId = locals.user.uid;

    const [target, packs, documents, connections, jobs, integrations, graphView, starterDocs] =
      await Promise.all([
        getGraphTargetForUi(wsId),
        listDomainPacksForUi(wsId),
        listSourceDocuments(wsId),
        listConnections(wsId),
        listConnectIngestJobsForWorkspace({ workspaceId: wsId }),
        listProviderIntegrations(wsId).catch(() => []),
        loadConnectGraphView(wsId).catch(() => null),
        listStarterCorpusDocuments(wsId),
      ]);

    const stats = graphView?.stats ?? null;

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
    const surrealStoreReady =
      Boolean(target?.provider === "surreal" && target.status === "ok");
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

    const aiKeysDone = modelsStatus.modelsReady;
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

    const steps = [
      {
        id: "graph_store",
        title: "Choose where your graph lives",
        description:
          "Connect Surreal Cloud (or another SurrealDB instance) so extracted ideas and edges have a durable graph home.",
        status: target ? "done" : "todo",
        detail: target
          ? target.provider === "surreal"
            ? target.status === "ok"
              ? "SurrealDB connected"
              : `SurrealDB (${target.status})`
            : `Connected: ${target.provider}`
          : "Not connected yet",
        href: pipelineWizardHref("store"),
        cta: target ? "Review store" : "Connect store",
      },
      {
        id: "ai_keys",
        title: "Add AI keys & configure routes",
        description:
          "You need at least two model capabilities: one chat model for extraction, grouping, validation, and remediation, plus one embedding model. Configure Keys ingestion routes per stage.",
        status: aiKeysDone ? "done" : "todo",
        detail: aiKeysDetail,
        href: withWizardReturn(`${K}/models`, "sources"),
        cta: aiKeysDone ? "Models & routes" : "Add keys & routes",
      },
      {
        id: "domain_pack",
        title: "Design your graph",
        description:
          "Tell the AI what to capture and how ideas connect. The Graph Designer drafts this from your intent and a sample of your documents — you just review it.",
        status: customPack ? "done" : "todo",
        detail: customPack ? `Using "${customPack.title}"` : "Using a built-in pack (you can customise)",
        href: pipelineWizardHref("domain"),
        cta: customPack ? "Edit design" : "Design graph",
        optional: true,
      },
      {
        id: "sources",
        title: "Add your documents",
        description:
          "Load the starter philosophy corpus or bring your own files, URLs, and connectors.",
        status: parsedDocs.length > 0 ? "done" : "todo",
        detail:
          parsedDocs.length > 0
            ? `${parsedDocs.length} document(s) ready${starterCorpusLoaded ? " (starter corpus loaded)" : ""}${connections.length ? `, ${connections.length} connection(s)` : ""}`
            : "No documents added yet",
        href: pipelineWizardHref("sources"),
        cta: parsedDocs.length > 0 ? "Add more" : "Add documents",
      },
      {
        id: "run",
        title: "Run ingest — turn docs into agent-ready context",
        description:
          "Start a named run using the pipeline you configured. You'll land on live progress as each stage completes.",
        status: jobs.length > 0 ? "done" : "todo",
        detail: jobs.length > 0 ? `${jobs.length} run(s)` : "No runs yet",
        href: target && parsedDocs.length > 0 ? pipelineWizardHref("run") : pipelineWizardHref("ready"),
        cta: jobs.length > 0 ? "Start another run" : "Start your run",
      },
      {
        id: "monitor",
        title: "Monitor & validate",
        description:
          "Watch each run progress through the stages and review validation — which extracted ideas are well-supported by your sources.",
        status: latestJob ? "done" : "todo",
        detail: latestJob ? `Latest: ${latestJob.status}` : "Nothing to monitor yet",
        href: latestJob ? `${K}/ingest/${latestJob.id}?from=pipeline` : `${K}/ingest`,
        cta: latestJob ? "View latest run" : "View runs",
      },
    ];

    const completed = steps.filter((s) => s.status === "done").length;
    const nextStep = steps.find((s) => s.status !== "done" && !s.optional) ?? null;

    const firstGraphGuide = {
      surrealStoreReady,
      modelsReady: modelsStatus.modelsReady,
      hasChatRoute: modelsStatus.hasChatRoute,
      hasEmbeddingRoute: modelsStatus.hasEmbeddingRoute,
      starterCorpusLoaded,
      customPackSaved: Boolean(customPack),
      hasIngestJob: jobs.length > 0,
      hasGraph,
      integrationsCount: integrations.length,
    };

    return {
      journey: {
        steps,
        completed,
        total: steps.length,
        nextStepId: nextStep?.id ?? null,
        latestJob,
        stats,
        flags: { llmReady, encryptionReady },
      },
      firstGraphGuide,
    };
  } catch {
    return { journey: null, firstGraphGuide: null };
  }
};
