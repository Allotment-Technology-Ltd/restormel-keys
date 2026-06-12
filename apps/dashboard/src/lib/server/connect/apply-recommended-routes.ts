/**
 * One-click production ingest routing: create/update per-stage routes, set recommended
 * model steps, publish, and bind route ids on the workspace Connect routing config.
 */
import {
  CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE,
  type ConnectModelStage,
  type ConnectStageRouting,
} from "@restormel/contracts/connect";
import { INGESTION_WORKLOAD } from "$lib/server/ingestion-routing";
import {
  createRoute,
  createRouteStep,
  deleteRouteStep,
  getModel,
  getRouteWithSteps,
  listRouteSteps,
  listRoutes,
  updateRoute,
  upsertConnectStageRoutingConfig,
} from "$lib/server/neon";
import { listProviderIntegrations } from "$lib/server/db";
import {
  normalizeProviderForStorage,
  normalizeProviderToCanonicalApi,
} from "$lib/server/canonical-provider";
import { validateRouteStepsForPublish } from "$lib/server/route-publish-validation";
import {
  buildCrossModelProductionChain,
  guidanceForStage,
  type IngestModelRecommendation,
} from "$lib/server/connect/model-guidance";
import { ensureModelCatalogSynced } from "$lib/server/connect/model-catalog-sync";
import { getConnectStageRouting } from "$lib/server/connect/stage-routing";
import { ensureProviderBindingsForProviders } from "$lib/server/connect/ensure-provider-bindings";
import { getWorkspaceEmbeddingLock } from "$lib/server/connect/embedding-contract";
import { resolveUpstreamValidationContext } from "$lib/server/connect/resolve-stage-route-models";
import {
  getSelectedDomainPackId,
  listDomainPacksForUi,
  resolvePipelineDomainPack,
} from "$lib/server/connect/domain-pack-service";

const STAGES: ConnectModelStage[] = [
  "extraction",
  "grouping",
  "validation",
  "remediation",
  "embedding",
];

export type AppliedStageRoute = {
  stage: ConnectModelStage;
  routeId: string;
  routeName: string;
  modelId: string;
  provider: string;
  published: boolean;
  created: boolean;
  /**
   * K3 (K-P0-2): a provider_bindings row for this stage's provider exists on the
   * project after apply — `bindingCreated` is true when apply had to create it.
   */
  bindingEnsured: boolean;
  bindingCreated: boolean;
};

export type ApplyRecommendedRoutesResult = {
  applied: AppliedStageRoute[];
  skipped: { stage: ConnectModelStage; reason: string }[];
  catalogSynced: boolean;
};

async function publishRoute(args: {
  routeId: string;
  projectId: string;
  userId: string;
  actorType: string;
}): Promise<boolean> {
  const routeWithSteps = await getRouteWithSteps(args.routeId, args.projectId, args.userId);
  if (!routeWithSteps) return false;
  const errors = validateRouteStepsForPublish(routeWithSteps.route, routeWithSteps.steps);
  if (errors.length > 0) return false;
  const nextVersion =
    Math.max(routeWithSteps.route.version ?? 1, routeWithSteps.route.publishedVersion ?? 1) + 1;
  const published = await updateRoute(args.routeId, args.projectId, args.userId, {
    version: nextVersion,
    publishedVersion: nextVersion,
    updatedVia: args.actorType,
    updatedBy: args.userId,
    changeSummary: `Published recommended production models (v${nextVersion})`,
  });
  return Boolean(published);
}

async function ensureStageRoute(args: {
  projectId: string;
  userId: string;
  environmentId: string;
  stage: ConnectModelStage;
  rec: IngestModelRecommendation;
}): Promise<{ routeId: string; created: boolean } | null> {
  const ingestionStage = CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE[args.stage];
  const meta = guidanceForStage(args.stage);
  const routeName = `Knowledge ${meta?.label ?? args.stage}`;

  const existing = await listRoutes(args.projectId, args.userId, {
    environmentId: args.environmentId,
    workload: INGESTION_WORKLOAD,
    stage: ingestionStage,
  });
  if (existing[0]) {
    return { routeId: existing[0].id, created: false };
  }

  const model = await getModel(args.rec.modelId);
  if (!model) return null;

  const route = await createRoute({
    projectId: args.projectId,
    environmentId: args.environmentId,
    name: routeName,
    description: "Production ingest route — applied from Connect recommended models",
    defaultModelId: args.rec.modelId,
    workload: INGESTION_WORKLOAD,
    stage: ingestionStage,
    enabled: true,
    publishedVersion: 0,
    version: 1,
    updatedVia: "connect_apply_recommended",
    changeSummary: "Created via Apply recommended models",
    userId: args.userId,
  });
  if (!route) return null;
  return { routeId: route.id, created: true };
}

async function replaceRoutePrimaryStep(args: {
  routeId: string;
  projectId: string;
  userId: string;
  rec: IngestModelRecommendation;
}): Promise<boolean> {
  const provider = normalizeProviderForStorage(args.rec.provider);
  if (!provider) return false;
  const model = await getModel(args.rec.modelId);
  if (!model) return false;

  const steps = await listRouteSteps(args.routeId, args.projectId, args.userId);
  for (const step of steps) {
    await deleteRouteStep(step.id, args.routeId, args.projectId, args.userId);
  }

  const step = await createRouteStep({
    routeId: args.routeId,
    projectId: args.projectId,
    userId: args.userId,
    orderIndex: 0,
    providerPreference: provider,
    modelId: args.rec.modelId,
    fallbackOn: "error",
    enabled: true,
    label: "Production (recommended)",
    notes: args.rec.rationale,
  });
  if (!step) return false;

  await updateRoute(args.routeId, args.projectId, args.userId, {
    defaultModelId: args.rec.modelId,
    changeSummary: `Set recommended model ${args.rec.modelId} (${provider})`,
    updatedVia: "connect_apply_recommended",
    updatedBy: args.userId,
  });
  return true;
}

export async function applyRecommendedIngestionRoutes(args: {
  workspaceId: string;
  userId: string;
  projectId: string;
  environmentId: string;
  actorType?: string;
}): Promise<ApplyRecommendedRoutesResult> {
  const { synced, modelCount } = await ensureModelCatalogSynced(true);
  const integrations = await listProviderIntegrations(args.workspaceId).catch(() => []);
  const providerTypes = new Set(integrations.map((i) => i.providerType).filter(Boolean));

  const routing = await getConnectStageRouting(args.workspaceId);
  const [packs, selectedPackId, upstream, embeddingLock] = await Promise.all([
    listDomainPacksForUi(args.workspaceId).catch(() => []),
    getSelectedDomainPackId(args.workspaceId).catch(() => null),
    resolveUpstreamValidationContext({
      projectId: args.projectId,
      userId: args.userId,
      environmentId: args.environmentId,
      routing,
    }).catch(() => ({ upstream: [], providers: new Set<string>(), modelIds: new Set<string>() })),
    getWorkspaceEmbeddingLock(args.workspaceId).catch(() => null),
  ]);
  const activePack = resolvePipelineDomainPack(packs, selectedPackId);
  const chain = buildCrossModelProductionChain(providerTypes, {
    upstream,
    embeddingDimensions: activePack?.embedding?.dimensions ?? 1024,
    embeddingLock: embeddingLock
      ? { ...embeddingLock, model: embeddingLock.model ?? activePack?.embedding?.model }
      : null,
  });

  const applied: AppliedStageRoute[] = [];
  const skipped: ApplyRecommendedRoutesResult["skipped"] = [];
  const routeBindings: NonNullable<ConnectStageRouting["routes"]> = {};

  for (const stage of STAGES) {
    const rec = chain[stage];
    if (!rec) {
      skipped.push({
        stage,
        reason: providerTypes.size
          ? "No recommended model for your connected providers"
          : "Connect at least one provider under Integrations first",
      });
      continue;
    }

    const ensured = await ensureStageRoute({
      projectId: args.projectId,
      userId: args.userId,
      environmentId: args.environmentId,
      stage,
      rec,
    });
    if (!ensured) {
      skipped.push({ stage, reason: `Model "${rec.modelId}" is not in the catalog` });
      continue;
    }

    const stepOk = await replaceRoutePrimaryStep({
      routeId: ensured.routeId,
      projectId: args.projectId,
      userId: args.userId,
      rec,
    });
    if (!stepOk) {
      skipped.push({ stage, reason: "Could not set route step (check provider connection)" });
      continue;
    }

    const published = await publishRoute({
      routeId: ensured.routeId,
      projectId: args.projectId,
      userId: args.userId,
      actorType: args.actorType ?? "session",
    });

    routeBindings[stage] = ensured.routeId;
    const meta = guidanceForStage(stage);
    applied.push({
      stage,
      routeId: ensured.routeId,
      routeName: `Knowledge ${meta?.label ?? stage}`,
      modelId: rec.modelId,
      provider: rec.provider,
      published,
      created: ensured.created,
      bindingEnsured: false,
      bindingCreated: false,
    });
  }

  // K3 (K-P0-2): the routes above resolve providers at run time via provider_bindings
  // on the project — ensure those bindings exist for every provider we just wired
  // (idempotent, mirroring testing-bootstrap's auto-bind).
  if (applied.length > 0) {
    const ensuredBindings = await ensureProviderBindingsForProviders({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      environmentId: args.environmentId,
      providers: applied.map((a) => a.provider),
      actorId: args.userId,
      actorType: args.actorType ?? "session",
    }).catch(() => []);
    const byProvider = new Map(ensuredBindings.map((b) => [b.provider, b]));
    for (const row of applied) {
      const canonical = normalizeProviderToCanonicalApi(row.provider) ?? row.provider;
      const match = byProvider.get(canonical) ?? byProvider.get(row.provider);
      if (match) {
        row.bindingEnsured = true;
        row.bindingCreated = match.created;
      }
    }
  }

  const existing = routing ?? {
    project_id: args.projectId,
    environment_id: args.environmentId,
  };
  await upsertConnectStageRoutingConfig(args.workspaceId, {
    ...existing,
    project_id: args.projectId,
    environment_id: args.environmentId,
    routes: { ...(existing.routes ?? {}), ...routeBindings },
  });

  return {
    applied,
    skipped,
    catalogSynced: synced && modelCount > 0,
  };
}
