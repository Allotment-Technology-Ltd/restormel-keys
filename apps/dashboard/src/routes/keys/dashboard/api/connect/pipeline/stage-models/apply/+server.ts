/**
 * One-click "Apply model to stage route" — POST endpoint.
 *
 * Body: { stage, provider, providerModelId }
 *
 * Finds the workspace's current routing config (or bootstraps one from the user's first
 * project). Finds an existing ingestion route for the stage, or creates a dedicated one.
 * Upserts the route's primary step with the chosen provider+model. Writes the
 * stage→routeId binding back to the workspace config.
 *
 * Auth: session only (workspace-scoped). Management keys are excluded — they can't
 * bootstrap a workspace ingestion context.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  listEnvironments,
  createRoute,
  listRouteSteps,
  createRouteStep,
  updateRouteStep,
} from "$lib/server/db";
import {
  getConnectStageRouting,
  listConnectStageRouteRows,
  CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE,
  type ConnectModelStage,
} from "$lib/server/connect/stage-routing";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import {
  upsertConnectStageRoutingConfig,
  listRoutes,
  getModel,
  resolveCanonicalModelIdForProviderModel,
} from "$lib/server/neon";
import { ensureModelCatalogSynced } from "$lib/server/connect/model-catalog-sync";
import { INGESTION_WORKLOAD } from "$lib/server/ingestion-routing";
import {
  normalizeProviderForStorage,
  ROUTE_STEP_ALLOWED_STORAGE_PROVIDERS,
} from "$lib/server/canonical-provider";
import { CONNECT_MODEL_STAGES } from "@restormel/contracts/connect";

const DASHBOARD_BASE = "/keys/dashboard";

export const POST: RequestHandler = async ({ locals, request }) => {
  // ── Auth: session only ─────────────────────────────────────────────────────
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  // ── Parse + validate body ──────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_body", message: "Body must be an object." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const stage = b.stage;
  if (typeof stage !== "string" || !(CONNECT_MODEL_STAGES as readonly string[]).includes(stage)) {
    return json(
      { error: "invalid_stage", message: `stage must be one of: ${CONNECT_MODEL_STAGES.join(", ")}` },
      { status: 400 },
    );
  }
  const connectStage = stage as ConnectModelStage;

  const rawProvider = b.provider;
  if (typeof rawProvider !== "string" || !rawProvider.trim()) {
    return json({ error: "invalid_provider", message: "provider must be a non-empty string." }, { status: 400 });
  }
  const provider = normalizeProviderForStorage(rawProvider);
  if (!provider || !ROUTE_STEP_ALLOWED_STORAGE_PROVIDERS.has(provider)) {
    return json(
      { error: "provider_not_allowed", message: `Provider "${rawProvider}" is not allowed for route steps.` },
      { status: 400 },
    );
  }

  const providerModelId = b.providerModelId;
  if (typeof providerModelId !== "string" || !providerModelId.trim()) {
    return json(
      { error: "invalid_model", message: "providerModelId must be a non-empty string." },
      { status: 400 },
    );
  }

  // ── Resolve the CANONICAL model id (route_steps.model_id FKs to models.id) ──
  // The client sends the PROVIDER's model string; writing it straight into model_id 500s with
  // a route_steps_model_id_fkey violation (the original "Apply failed: internal error" bug).
  // Sync the catalogue, then map (provider, providerModelId) → canonical models.id.
  await ensureModelCatalogSynced();
  let canonicalModelId = await resolveCanonicalModelIdForProviderModel(provider, providerModelId);
  if (!canonicalModelId && (await getModel(providerModelId))) {
    // Client already passed a canonical models.id (provider with no distinct variant string).
    canonicalModelId = providerModelId;
  }
  if (!canonicalModelId) {
    return json(
      {
        error: "model_not_in_catalog",
        message: `Model "${providerModelId}" (${provider}) isn't in the model catalogue yet — refresh the catalogue and try again, or pick another model.`,
      },
      { status: 422 },
    );
  }

  // ── Resolve project + environment ──────────────────────────────────────────
  const projects = ctx.projects;
  if (projects.length === 0) {
    return json(
      { error: "no_project", message: "No project found for your workspace. Create a project first." },
      { status: 422 },
    );
  }

  const existing = await getConnectStageRouting(ctx.workspaceId);
  const projectId = existing?.project_id ?? projects[0].id;
  let environmentId = existing?.environment_id ?? null;
  if (!environmentId) {
    const envs = await listEnvironments(projectId, ctx.userId);
    environmentId = envs[0]?.id ?? null;
  }
  if (!environmentId) {
    return json(
      { error: "no_environment", message: "No environment found for the project." },
      { status: 422 },
    );
  }

  // ── Find or create a dedicated ingestion route for this stage ──────────────
  const ingestionStage = CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE[connectStage];

  // Check if the routing config already has an explicit route for this stage.
  const overrideRouteId = existing?.routes?.[connectStage] ?? null;
  let routeId: string | null = overrideRouteId;

  if (routeId) {
    // Verify the override route still exists.
    const allRoutes = await listRoutes(projectId, ctx.userId);
    const found = allRoutes.find((r) => r.id === routeId);
    if (!found) {
      routeId = null; // stale override — fall through to find/create
    }
  }

  if (!routeId) {
    // Look for an existing dedicated ingestion route for this stage.
    const dedicated = await listRoutes(projectId, ctx.userId, {
      environmentId,
      workload: INGESTION_WORKLOAD,
      stage: ingestionStage,
    });

    const active = dedicated.find(
      (r) => r.status === "active" && (r.enabled ?? true),
    ) ?? dedicated[0] ?? null;

    if (active) {
      routeId = active.id;
    } else {
      // Create a new dedicated route for this stage.
      const stageLabel = connectStage.charAt(0).toUpperCase() + connectStage.slice(1);
      const created = await createRoute({
        projectId,
        environmentId,
        name: `${stageLabel} (auto-applied)`,
        description: `Auto-created via catalogue "Apply to ${connectStage}".`,
        workload: INGESTION_WORKLOAD,
        stage: ingestionStage,
        enabled: true,
        userId: ctx.userId,
        updatedVia: "catalogue-apply",
        changeSummary: `Created for ${connectStage} stage via catalogue one-click apply`,
      });
      if (!created) {
        return json(
          { error: "route_create_failed", message: "Could not create an ingestion route for this stage." },
          { status: 500 },
        );
      }
      routeId = created.id;
    }
  }

  // ── Upsert the primary step on the route with the chosen model ─────────────
  const steps = await listRouteSteps(routeId, projectId, ctx.userId);

  // Primary step = step with lowest orderIndex that is enabled.
  const primaryStep = steps
    .filter((s) => s.enabled !== false)
    .sort((a, b) => a.orderIndex - b.orderIndex)[0] ?? null;

  if (primaryStep) {
    await updateRouteStep(primaryStep.id, routeId, projectId, ctx.userId, {
      providerPreference: provider,
      modelId: canonicalModelId,
    });
  } else {
    await createRouteStep({
      routeId,
      projectId,
      userId: ctx.userId,
      orderIndex: 0,
      providerPreference: provider,
      modelId: canonicalModelId,
      label: null,
      enabled: true,
    });
  }

  // ── Persist the stage→routeId binding in workspace routing config ──────────
  const updatedRoutes = {
    ...(existing?.routes ?? {}),
    [connectStage]: routeId,
  };

  await upsertConnectStageRoutingConfig(ctx.workspaceId, {
    project_id: projectId,
    environment_id: environmentId,
    routes: updatedRoutes,
  });

  return json({
    ok: true,
    stage: connectStage,
    routeId,
    provider,
    providerModelId,
    routeHref: `${DASHBOARD_BASE}/projects/${projectId}/routes/${routeId}`,
  });
};

/**
 * GET: return the current per-stage applied model snapshot for the UI.
 * Returns { stages: Record<ConnectModelStage, { provider, providerModelId, routeId } | null> }
 */
export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const routing = await getConnectStageRouting(ctx.workspaceId);
  if (!routing) {
    return json({ stages: {} });
  }

  const projects = ctx.projects;
  const projectId = routing.project_id ?? projects[0]?.id ?? null;
  let environmentId = routing.environment_id ?? null;
  if (projectId && !environmentId) {
    const envs = await listEnvironments(projectId, ctx.userId);
    environmentId = envs[0]?.id ?? null;
  }
  if (!projectId || !environmentId) {
    return json({ stages: {} });
  }

  const stageRows = await listConnectStageRouteRows({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    projectId,
    environmentId,
    dashboardBase: DASHBOARD_BASE,
  });

  const stages: Record<string, { provider: string | null; providerModelId: string | null; routeId: string } | null> = {};
  for (const row of stageRows) {
    if (row.route && row.activeModel) {
      stages[row.key] = {
        routeId: row.route.id,
        provider: row.activeModel.provider,
        providerModelId: row.activeModel.modelId,
      };
    } else if (row.route) {
      stages[row.key] = { routeId: row.route.id, provider: null, providerModelId: null };
    } else {
      stages[row.key] = null;
    }
  }

  return json({ stages });
};
