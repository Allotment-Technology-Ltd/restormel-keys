import { redirect } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  isPipelineWizardStep,
  pipelineWizardHref,
  type PipelineRunDefaults,
  type PipelineWizardStepId,
} from "$lib/connect/pipeline-config";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";
import { getGraphTargetForUi } from "$lib/server/connect/graph-target-service";
import { listDomainPacksForUi, resolvePipelineDomainPack, getSelectedDomainPackId, getIngestDocumentSelection, resolveIngestDocuments } from "$lib/server/connect/domain-pack-service";
import { listConnections } from "$lib/server/connect/connections-service";
import { listSourceDocuments } from "$lib/server/connect/source-documents";
import { listConnectPipelineProfilesForWorkspace } from "$lib/server/neon";
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
    })),
    selectedDomainPackId: chosenPack?.id ?? null,
    defaultStopAfterStage: matchingProfile?.defaultStopAfterStage ?? null,
  };
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (url.searchParams.has("connector_connected") || url.searchParams.has("connector_error")) {
    const params = new URLSearchParams({ step: "sources" });
    for (const [key, value] of url.searchParams) {
      params.set(key, value);
    }
    throw redirect(302, `${DASHBOARD_BASE}/connect/pipeline?${params.toString()}`);
  }

  const requestedStep = url.searchParams.get("step");

  if (!locals.user || locals.user.authType !== "session") {
    const step = isPipelineWizardStep(requestedStep) ? requestedStep : "store";
    return { step, wizard: null, runDefaults: null };
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(locals.user.uid);
    const [target, packs, connections, documents, profiles, selectedDomainPackId, ingestDocumentSelection] = await Promise.all([
      getGraphTargetForUi(workspace.id),
      listDomainPacksForUi(workspace.id),
      listConnections(workspace.id),
      listSourceDocuments(workspace.id),
      listConnectPipelineProfilesForWorkspace(workspace.id),
      getSelectedDomainPackId(workspace.id),
      getIngestDocumentSelection(workspace.id),
    ]);

    const activePack = resolvePipelineDomainPack(packs, selectedDomainPackId);
    const customPack = packs.find((p) => !p.is_builtin) ?? null;
    const parsedDocumentCount = documents.filter((d) => d.status === "parsed").length;
    const selectedDocumentCount = resolveIngestDocuments(documents, ingestDocumentSelection).length;
    const wizard = {
      hasGraphStore: Boolean(target),
      graphStoreLabel: graphStoreLabel(target),
      hasCustomPack: Boolean(customPack),
      packTitle: activePack?.title ?? packs[0]?.title ?? null,
      selectedDomainPackId: activePack?.id ?? null,
      connectionCount: connections.length,
      parsedDocumentCount,
      selectedDocumentCount,
    };

    if (!requestedStep) {
      let defaultStep: PipelineWizardStepId = "store";
      if (wizard.hasGraphStore) {
        defaultStep = parsedDocumentCount > 0 ? "ready" : "domain";
      }
      throw redirect(302, pipelineWizardHref(defaultStep));
    }

    const step = isPipelineWizardStep(requestedStep) ? requestedStep : "store";

    if (!target && step !== "store") {
      throw redirect(302, pipelineWizardHref("store"));
    }

    const domainPackOverride = url.searchParams.get("domain_pack_id");

    const runDefaults =
      step === "run"
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

    return { step, wizard, runDefaults, domainPacks: packs, selectedDomainPackId: activePack?.id ?? null };
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && "location" in e) throw e;
    const step = isPipelineWizardStep(requestedStep) ? requestedStep : "store";
    return { step, wizard: null, runDefaults: null };
  }
};
