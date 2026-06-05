/**
 * Resolve primary model + provider from published Connect / ingestion routes.
 */
import type { ConnectModelStage, ConnectStageRouting } from "@restormel/contracts/connect";
import { CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE } from "@restormel/contracts/connect";
import { INGESTION_WORKLOAD } from "$lib/server/ingestion-routing";
import { getModel, listProviderModelVariants, listRouteSteps, listRoutes } from "$lib/server/neon";
import { isRoutePublished } from "$lib/server/route-resolver";
import type { StageRouteUiRow } from "$lib/server/connect/stage-routing";

export type ResolvedStageModel = {
  modelId: string;
  provider: string;
  routeId: string;
};

export type UpstreamValidationContext = {
  /** extraction, grouping, and optional ingestion_relations route models. */
  upstream: ResolvedStageModel[];
  providers: Set<string>;
  modelIds: Set<string>;
};

const UPSTREAM_STAGES_FOR_VALIDATION: ConnectModelStage[] = ["extraction", "grouping"];

export async function resolvePrimaryStepModel(args: {
  routeId: string;
  projectId: string;
  userId: string;
}): Promise<ResolvedStageModel | null> {
  const steps = await listRouteSteps(args.routeId, args.projectId, args.userId);
  const step = steps.find((s) => s.enabled !== false && s.modelId) ?? steps[0];
  if (!step?.modelId) return null;

  let provider = step.providerPreference?.trim().toLowerCase() ?? "";
  if (!provider) {
    const variants = await listProviderModelVariants(step.modelId);
    provider = variants[0]?.providerIntegrationType?.trim().toLowerCase() ?? "";
  }
  if (!provider) {
    const model = await getModel(step.modelId);
    if (!model) return null;
    // Last resort: infer from model id prefix patterns in catalog
    if (step.modelId.startsWith("claude")) provider = "anthropic";
    else if (step.modelId.startsWith("gpt") || step.modelId.startsWith("text-embedding")) provider = "openai";
    else if (step.modelId.startsWith("gemini")) provider = "google";
    else if (step.modelId.startsWith("voyage")) provider = "voyage";
  }

  return { modelId: step.modelId, provider, routeId: args.routeId };
}

async function resolveIngestionStageRoute(args: {
  projectId: string;
  userId: string;
  environmentId: string;
  ingestionStage: string;
  routeIdOverride?: string | null;
}): Promise<ResolvedStageModel | null> {
  let routeId = args.routeIdOverride ?? null;
  if (!routeId) {
    const dedicated = await listRoutes(args.projectId, args.userId, {
      environmentId: args.environmentId,
      workload: INGESTION_WORKLOAD,
      stage: args.ingestionStage,
    });
    const route =
      dedicated.find((r) => r.status === "active" && (r.enabled ?? true) && isRoutePublished(r)) ??
      dedicated[0] ??
      null;
    routeId = route?.id ?? null;
  }
  if (!routeId) return null;
  return resolvePrimaryStepModel({
    routeId,
    projectId: args.projectId,
    userId: args.userId,
  });
}

/** Collect models used by extract / relate / grouping routes for cross-model validation. */
export async function resolveUpstreamValidationContext(args: {
  projectId: string;
  userId: string;
  environmentId: string;
  routing?: ConnectStageRouting | null;
  stageRows?: StageRouteUiRow[];
}): Promise<UpstreamValidationContext> {
  const upstream: ResolvedStageModel[] = [];
  const routeOverrides = args.routing?.routes ?? {};

  for (const stage of UPSTREAM_STAGES_FOR_VALIDATION) {
    const routeId = routeOverrides[stage] ?? args.stageRows?.find((r) => r.key === stage)?.route?.id;
    const resolved = await resolveIngestionStageRoute({
      projectId: args.projectId,
      userId: args.userId,
      environmentId: args.environmentId,
      ingestionStage: CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE[stage],
      routeIdOverride: routeId,
    });
    if (resolved) upstream.push(resolved);
  }

  const relations = await resolveIngestionStageRoute({
    projectId: args.projectId,
    userId: args.userId,
    environmentId: args.environmentId,
    ingestionStage: "ingestion_relations",
  });
  if (relations) upstream.push(relations);

  const providers = new Set(upstream.map((u) => u.provider));
  const modelIds = new Set(upstream.map((u) => u.modelId));
  return { upstream, providers, modelIds };
}
