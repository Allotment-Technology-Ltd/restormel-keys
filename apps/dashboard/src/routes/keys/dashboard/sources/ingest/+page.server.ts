import { redirect } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  CONNECT_PIPELINE_BASE,
  isLegacyPipelineWizardStep,
  isPipelineWizardStep,
  pipelineWizardHref,
  type PipelineRunDefaults,
  type PipelineWizardStepId,
} from "$lib/connect/pipeline-config";
import { resolveConnectJourneyPhase, resolveDefaultPipelineStep } from "$lib/connect/connect-journey";
import { listProviderIntegrations } from "$lib/server/db";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import { peekConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import { loadConnectTrustScorecard } from "$lib/server/connect/trust-scorecard-service";
import { getGraphTargetForUi, connectDashboardNeonTarget } from "$lib/server/connect/graph-target-service";
import { isModuleEnabled } from "$lib/server/module-flags";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import {
  listDomainPacksForUi,
  resolvePipelineDomainPack,
  getSelectedDomainPackId,
  getIngestDocumentSelection,
  resolveIngestDocuments,
} from "$lib/server/connect/domain-pack-service";
import { listConnections } from "$lib/server/connect/connections-service";
import { listSourceDocuments } from "$lib/server/connect/source-documents";
import { listConnectPipelineProfilesForWorkspace } from "$lib/server/neon";
import { computeConnectModelsReady } from "$lib/server/connect/stage-routing";
import { computeConnectRunPreflight } from "$lib/server/connect/run-preflight";
import { ensureWorkspaceInfrastructureRouting } from "$lib/server/connect/workspace-infrastructure";
import { isLlmConfigured } from "$lib/server/connect/llm-generate";
import { AGENTS_HREF } from "$lib/nav-config";
import { perfSpan } from "$lib/debug/server-perf";
import type { PageServerLoad } from "./$types";

function graphStoreLabel(target: Awaited<ReturnType<typeof getGraphTargetForUi>>): string | null {
  if (!target) return null;
  if (target.provider === "postgres" && target.use_dashboard_database) return "Workspace Neon database";
  if (target.provider === "postgres") return "Postgres";
  const ns = target.connection.namespace;
  const db = target.connection.database;
  if (ns && db) return `${ns} / ${db}`;
  return target.provider;
}

function resolveRunDefaults(params: {
  target: Awaited<ReturnType<typeof getGraphTargetForUi>>;
  packs: Awaited<ReturnType<typeof listDomainPacksForUi>>;
  profiles: Awaited<ReturnType<typeof listConnectPipelineProfilesForWorkspace>>;
  documents: Awaited<ReturnType<typeof listSourceDocuments>>;
  selectedDomainPackId: string | null;
  ingestDocumentSelection: string[] | null;
  domainPackOverride: string | null;
}): PipelineRunDefaults {
  const chosenPack = resolvePipelineDomainPack(
    params.packs,
    params.domainPackOverride ?? params.selectedDomainPackId,
  );
  const targetId = params.target?.id ?? null;

  const matchingProfile =
    params.profiles.find(
      (p) =>
        p.domainPackId === chosenPack?.id &&
        (!p.graphTargetId || !targetId || p.graphTargetId === targetId),
    ) ?? params.profiles[0] ??
    null;

  const parsedDocs = resolveIngestDocuments(params.documents, params.ingestDocumentSelection);

  return {
    graphTargetId: targetId,
    domainPackId: matchingProfile?.domainPackId ?? chosenPack?.id ?? null,
    pipelineProfileId: matchingProfile?.id ?? null,
    packTitle: chosenPack?.title ?? null,
    graphStoreLabel: graphStoreLabel(params.target),
    documents: parsedDocs.map((d) => ({
      id: d.id,
      name: d.name,
      chunk_count: d.chunk_count,
    })),
    packs: params.packs.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      ...(p.description ? { description: p.description } : {}),
      is_builtin: p.is_builtin,
      quality_preset: p.quality_preset ?? "production",
      cross_model_validation: p.cross_model_validation !== false,
    })),
    selectedDomainPackId: chosenPack?.id ?? null,
    defaultStopAfterStage: matchingProfile?.defaultStopAfterStage ?? null,
  };
}

export const load: PageServerLoad = async ({ locals, url, depends, parent }) => {
  if (url.searchParams.has("connector_connected") || url.searchParams.has("connector_error")) {
    const params = new URLSearchParams({ step: "sources" });
    for (const [key, value] of url.searchParams) {
      params.set(key, value);
    }
    throw redirect(302, `${CONNECT_PIPELINE_BASE}?${params.toString()}`);
  }

  let requestedStep = url.searchParams.get("step");

  if (isLegacyPipelineWizardStep(requestedStep)) {
    const params = new URLSearchParams(url.searchParams);
    params.set("step", "launch");
    throw redirect(302, `${CONNECT_PIPELINE_BASE}?${params.toString()}`);
  }

  if (!locals.user || locals.user.authType !== "session") {
    const step = isPipelineWizardStep(requestedStep) ? requestedStep : "provider";
    return { step, wizard: null, runDefaults: null, modelsReady: false, phase: "initial" as const };
  }

  if (requestedStep === "agents") {
    throw redirect(302, AGENTS_HREF);
  }

  try {
    const endPipeline = perfSpan("connect/pipeline", "load");
    const workspace = await requireConnectWorkspace(locals, parent);
    depends(`app:connect-pipeline:${workspace.id}`);

    // R7 (D4): first flow entry auto-provisions the Connect-owned "Workspace
    // infrastructure" project as the routing default when no routing config exists
    // yet (mirroring testing-bootstrap; idempotent — a one-query no-op once any
    // routing config is set, so existing custom setups are untouched). Best-effort:
    // provisioning failure never blocks flow entry; the store/models/preflight
    // gates below still apply.
    await ensureWorkspaceInfrastructureRouting({
      workspaceId: workspace.id,
      userId: locals.user.uid,
      actorType: locals.user.authType,
    }).catch((e) => {
      console.warn(
        "[connect] workspace-infrastructure provisioning skipped:",
        e instanceof Error ? e.message.slice(0, 160) : String(e),
      );
      return null;
    });

    // R4 (§1.1): the store step is demoted to automated-with-override. When the
    // host-managed Neon graph store is enabled, provision the workspace Neon
    // default best-effort on flow entry (idempotent — reuses any existing
    // dashboard-Neon graph), so the `!target && step !== "store"` gate below no
    // longer forces the store step onto the default path. Best-effort: a failure
    // never blocks flow entry, and BYO store + claim-versions stay reachable via
    // "Configure store" on the launch panel (W3.6 placement). When the module is
    // disabled (MVP default), this is a no-op and the BYO store override applies.
    const moduleFlags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
    if (isModuleEnabled(moduleFlags, "connectNeonGraphStore")) {
      await connectDashboardNeonTarget(workspace.id).catch((e) => {
        console.warn(
          "[connect] workspace Neon graph-store auto-provision skipped:",
          e instanceof Error ? e.message.slice(0, 160) : String(e),
        );
        return null;
      });
    }

    if (!requestedStep) {
      const [target, documents, integrations] = await Promise.all([
        getGraphTargetForUi(workspace.id),
        listSourceDocuments(workspace.id),
        listProviderIntegrations(workspace.id).catch(() => []),
      ]);
      const parsedDocumentCount = documents.filter((d) => d.status === "parsed").length;
      const modelsStatus = await computeConnectModelsReady({
        workspaceId: workspace.id,
        userId: locals.user.uid,
        integrationsCount: integrations.length,
        llmReady: isLlmConfigured(),
        dashboardBase: DASHBOARD_BASE,
      });
      const phase = resolveConnectJourneyPhase({
        hasGraphStore: Boolean(target),
        modelsReady: modelsStatus.modelsReady,
        parsedDocumentCount,
      });
      const defaultStep = resolveDefaultPipelineStep({
        phase,
        hasGraphStore: Boolean(target),
        parsedDocumentCount,
        hasProviderKey: integrations.length > 0,
      });
      throw redirect(302, pipelineWizardHref(defaultStep));
    }

    const step = isPipelineWizardStep(requestedStep) ? requestedStep : "provider";

    const [target, packs, connections, documents, profiles, selectedDomainPackId, ingestDocumentSelection, integrations, stats] =
      await Promise.all([
        getGraphTargetForUi(workspace.id),
        listDomainPacksForUi(workspace.id),
        listConnections(workspace.id),
        listSourceDocuments(workspace.id),
        listConnectPipelineProfilesForWorkspace(workspace.id),
        getSelectedDomainPackId(workspace.id),
        getIngestDocumentSelection(workspace.id),
        listProviderIntegrations(workspace.id).catch(() => []),
        peekConnectGraphStats(workspace.id).catch(() => null),
      ]);

    const parsedDocumentCount = documents.filter((d) => d.status === "parsed").length;
    const modelsStatus = await computeConnectModelsReady({
      workspaceId: workspace.id,
      userId: locals.user.uid,
      integrationsCount: integrations.length,
      llmReady: isLlmConfigured(),
      dashboardBase: DASHBOARD_BASE,
    });
    const phase = resolveConnectJourneyPhase({
      hasGraphStore: Boolean(target),
      modelsReady: modelsStatus.modelsReady,
      parsedDocumentCount,
    });

    const activePack = resolvePipelineDomainPack(packs, selectedDomainPackId);
    const customPack = packs.find((p) => !p.is_builtin) ?? null;
    const selectedDocumentCount = resolveIngestDocuments(documents, ingestDocumentSelection).length;
    const hasGraph = Boolean(stats && stats.units > 0);
    const wizard = {
      hasGraphStore: Boolean(target),
      graphStoreLabel: graphStoreLabel(target),
      hasProviderKey: integrations.length > 0,
      hasCustomPack: Boolean(customPack),
      packTitle: activePack?.title ?? packs[0]?.title ?? null,
      selectedDomainPackId: activePack?.id ?? null,
      connectionCount: connections.length,
      parsedDocumentCount,
      selectedDocumentCount,
      hasGraph,
      agentReady: false,
      modelsReady: modelsStatus.modelsReady,
    };

    // R4 (§1.1): the store step is demoted — a missing graph store no longer
    // forces the store step onto the default path (the workspace Neon default is
    // auto-provisioned on entry when enabled; BYO store stays reachable via
    // "Configure store"). The launch gate + jobs BFF enforce a graph target
    // server-side, so the run can never start without a store regardless.

    const domainPackOverride = url.searchParams.get("domain_pack_id");

    const runDefaults =
      step === "launch"
        ? resolveRunDefaults({
            target,
            packs,
            profiles,
            documents,
            selectedDomainPackId,
            ingestDocumentSelection,
            domainPackOverride,
          })
        : null;

    // Launch step "What to expect": the previous run's trust scorecard, when a graph
    // already exists. Peek-only (cached stats — never scans a BYO store) so the wizard
    // stays fast; best-effort, and absence never gates the run.
    const previousScorecard =
      step === "launch" && hasGraph
        ? await loadConnectTrustScorecard(workspace.id, { statsMode: "peek" }).catch(() => null)
        : null;

    // K3 launch gate: per-provider binding/credential preflight (the lookup the worker
    // performs mid-run). Null on compute failure — the panel treats null as "could not
    // check" and the jobs BFF re-enforces server-side, so a load hiccup never bricks
    // the gate (and never bypasses modelsReady or any existing gating).
    const runPreflight =
      step === "launch"
        ? await computeConnectRunPreflight({
            workspaceId: workspace.id,
            userId: locals.user.uid,
          }).catch(() => null)
        : null;

    const payload = {
      step,
      wizard,
      runDefaults,
      previousScorecard,
      runPreflight,
      modelsReady: modelsStatus.modelsReady,
      phase,
      workspaceId: workspace.id,
      domainPacks: packs,
      selectedDomainPackId: activePack?.id ?? null,
    };
    endPipeline();
    return payload;
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && "location" in e) throw e;
    const step = isPipelineWizardStep(requestedStep) ? requestedStep : "provider";
    // Signed-in load failure — distinct from the signed-out shape above so the UI
    // can show an error with a retry instead of a misleading sign-in prompt.
    return {
      step,
      wizard: null,
      runDefaults: null,
      modelsReady: false,
      phase: "initial" as const,
      loadFailed: true,
    };
  }
};
