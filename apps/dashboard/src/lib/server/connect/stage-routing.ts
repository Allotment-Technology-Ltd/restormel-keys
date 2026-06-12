/**
 * Knowledge ingestion ↔ Keys route stage mapping and workspace routing config helpers.
 */
import {
  CONNECT_MODEL_STAGES,
  CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE,
  ConnectStageRoutingSchema,
  type ConnectModelStage,
  type ConnectStageRouting,
} from "@restormel/contracts/connect";
import { INGESTION_WORKLOAD } from "$lib/server/ingestion-routing";
import { getWorkspace, listEnvironments, listProjectsByWorkspace } from "$lib/server/db";
import { getConnectStageRoutingConfig, listRoutes, type RouteRecord } from "$lib/server/neon";
import { resolvePrimaryStepModel } from "$lib/server/connect/resolve-stage-route-models";
import { isRoutePublished } from "$lib/server/route-resolver";

export { CONNECT_MODEL_STAGES, CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE };
export type { ConnectModelStage, ConnectStageRouting };

/**
 * K5 run attribution hooks (optional). When present, the stage-route executor
 * reports which route/step/provider/model served each stage (`onStageServed`) and
 * writes a request-log row per resolve attempt (`onResolveAttempt`). Both are
 * fire-and-forget from the executor's perspective — capture must never break a run.
 * Defined as a structural shape (not imported) to avoid a server-module import cycle
 * (stage-attribution → contracts only).
 */
export type ConnectStageServedSnapshot = {
  routeId?: string | null;
  routeName?: string | null;
  projectId?: string | null;
  stepId?: string | null;
  stepOrderIndex?: number | null;
  provider?: string | null;
  modelId?: string | null;
  attemptNumber?: number | null;
};

export type ConnectResolveAttemptRecord = {
  /** "resolved" when the upstream call succeeded; "failed" when the attempt errored. */
  status: "resolved" | "failed";
  routeId?: string | null;
  provider?: string | null;
  modelId?: string | null;
  latencyMs: number;
  errorCode?: string | null;
  /** 0-based attempt index in the resolve loop (>0 means a fallback step). */
  attemptNumber: number;
};

export type ConnectRouteExecutionContext = {
  workspaceId: string;
  userId: string;
  projectId: string;
  environmentId: string;
  routing: ConnectStageRouting;
  /** K5: report a stage's last successful resolve for run-attribution capture. */
  onStageServed?: (stage: ConnectModelStage, snap: ConnectStageServedSnapshot) => void;
  /** K5: write a request-log row (source=connect_ingest) per resolve attempt. */
  onResolveAttempt?: (stage: ConnectModelStage, rec: ConnectResolveAttemptRecord) => void;
};

export type StageRouteUiRow = {
  key: ConnectModelStage;
  label: string;
  help: string;
  ingestionStage: string;
  route: {
    id: string;
    name: string;
    status: string;
    isPublished: boolean;
    enabled: boolean;
  } | null;
  visualHref: string | null;
  /** Primary enabled step model on the linked route, when resolvable at load time. */
  activeModel: { modelId: string; provider: string } | null;
};

const STAGE_META: { key: ConnectModelStage; label: string; help: string }[] = [
  {
    key: "extraction",
    label: "Extraction & relations",
    help: "Reads documents to pull out ideas and how they connect.",
  },
  { key: "grouping", label: "Grouping", help: "Clusters ideas into named groups." },
  { key: "validation", label: "Validation", help: "Checks each idea is supported by the source." },
  { key: "remediation", label: "Remediation", help: "Repairs or drops weak ideas (self-healing)." },
  { key: "embedding", label: "Embedding", help: "Turns ideas into vectors for search." },
];

function parseRoutingConfig(raw: unknown): ConnectStageRouting | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.project_id === "string") {
    const parsed = ConnectStageRoutingSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }
  return null;
}

/** Read stored config; returns null when unset or legacy model-chain shape. */
export async function getConnectStageRouting(workspaceId: string): Promise<ConnectStageRouting | null> {
  const raw = await getConnectStageRoutingConfig(workspaceId);
  return parseRoutingConfig(raw);
}

function pickSelectableRoute(routes: RouteRecord[]): RouteRecord | null {
  return (
    routes.find(
      (r) => r.status === "active" && (r.enabled ?? true) && isRoutePublished(r),
    ) ?? routes[0] ?? null
  );
}

export async function resolveKnowledgeRouteExecutionContext(args: {
  workspaceId: string;
  userId: string;
  projectId?: string | null;
}): Promise<ConnectRouteExecutionContext | null> {
  const routing = await getConnectStageRouting(args.workspaceId);
  if (!routing?.project_id) return null;

  let projectId = routing.project_id;
  if (args.projectId?.trim()) projectId = args.projectId.trim();

  let environmentId = routing.environment_id?.trim();
  if (!environmentId) {
    const envs = await listEnvironments(projectId, args.userId);
    environmentId = envs[0]?.id;
  }
  if (!environmentId) return null;

  return {
    workspaceId: args.workspaceId,
    userId: args.userId,
    projectId,
    environmentId,
    routing: { ...routing, project_id: projectId, environment_id: environmentId },
  };
}

/** Resolve workspace owner + default/first project when no routing config exists yet. */
export async function resolveDefaultKnowledgeProject(args: {
  workspaceId: string;
  userId: string;
}): Promise<{ projectId: string; environmentId: string | null } | null> {
  const routing = await getConnectStageRouting(args.workspaceId);
  if (routing?.project_id) {
    const envs = await listEnvironments(routing.project_id, args.userId);
    return {
      projectId: routing.project_id,
      environmentId: routing.environment_id ?? envs[0]?.id ?? null,
    };
  }
  const projects = await listProjectsByWorkspace(args.workspaceId);
  const project = projects[0];
  if (!project) return null;
  const envs = await listEnvironments(project.id, args.userId);
  return { projectId: project.id, environmentId: envs[0]?.id ?? null };
}

export async function listConnectStageRouteRows(args: {
  workspaceId: string;
  userId: string;
  projectId: string;
  environmentId: string;
  dashboardBase?: string;
}): Promise<StageRouteUiRow[]> {
  const base = args.dashboardBase ?? "/keys/dashboard";
  const routing = (await getConnectStageRouting(args.workspaceId)) ?? {
    project_id: args.projectId,
    environment_id: args.environmentId,
  };
  const overrideRoutes = routing.routes ?? {};

  const rows: StageRouteUiRow[] = [];
  for (const meta of STAGE_META) {
    const ingestionStage = CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE[meta.key];
    const routeIdOverride = overrideRoutes[meta.key];
    let route: RouteRecord | null = null;

    if (routeIdOverride) {
      const all = await listRoutes(args.projectId, args.userId);
      route = all.find((r) => r.id === routeIdOverride) ?? null;
    } else {
      const dedicated = await listRoutes(args.projectId, args.userId, {
        environmentId: args.environmentId,
        workload: INGESTION_WORKLOAD,
        stage: ingestionStage,
      });
      route = pickSelectableRoute(dedicated);
      if (!route) {
        const shared = await listRoutes(args.projectId, args.userId, {
          environmentId: args.environmentId,
          workload: INGESTION_WORKLOAD,
        });
        route =
          shared.find(
            (r) =>
              (r.stage == null || r.stage === "") &&
              r.status === "active" &&
              (r.enabled ?? true) &&
              isRoutePublished(r),
          ) ?? null;
      }
    }

    let activeModel: { modelId: string; provider: string } | null = null;
    if (route) {
      const resolved = await resolvePrimaryStepModel({
        routeId: route.id,
        projectId: args.projectId,
        userId: args.userId,
      }).catch(() => null);
      if (resolved?.modelId && resolved.provider) {
        activeModel = { modelId: resolved.modelId, provider: resolved.provider };
      }
    }

    rows.push({
      key: meta.key,
      label: meta.label,
      help: meta.help,
      ingestionStage,
      route: route
        ? {
            id: route.id,
            name: route.name,
            status: route.status,
            isPublished: isRoutePublished(route),
            enabled: route.enabled ?? true,
          }
        : null,
      visualHref: route
        ? `${base}/projects/${args.projectId}/routes/${route.id}?flow=visual`
        : null,
      activeModel,
    });
  }
  return rows;
}

const CHAT_MODEL_STAGES: ConnectModelStage[] = [
  "extraction",
  "grouping",
  "validation",
  "remediation",
];

export function evaluateConnectModelsReady(args: {
  stageRows: StageRouteUiRow[];
  integrationsCount: number;
  llmReady: boolean;
  hasProjectRouting: boolean;
}): { modelsReady: boolean; hasChatRoute: boolean; hasEmbeddingRoute: boolean } {
  if (!args.hasProjectRouting) {
    if (args.llmReady && args.integrationsCount === 0) {
      return { modelsReady: true, hasChatRoute: true, hasEmbeddingRoute: true };
    }
    return { modelsReady: false, hasChatRoute: false, hasEmbeddingRoute: false };
  }

  const embedRow = args.stageRows.find((r) => r.key === "embedding");
  const hasEmbeddingRoute = Boolean(embedRow?.route?.isPublished && embedRow.route.enabled);
  const hasChatRoute = CHAT_MODEL_STAGES.some((stage) => {
    const row = args.stageRows.find((r) => r.key === stage);
    return Boolean(row?.route?.isPublished && row.route.enabled);
  });

  const modelsReady =
    hasChatRoute && hasEmbeddingRoute && (args.integrationsCount > 0 || args.llmReady);

  return { modelsReady, hasChatRoute, hasEmbeddingRoute };
}

/** Minimum ingestion routing for first-graph onboarding: published chat + embedding routes. */
export async function computeConnectModelsReady(args: {
  workspaceId: string;
  userId: string;
  integrationsCount: number;
  llmReady: boolean;
  dashboardBase?: string;
}): Promise<{ modelsReady: boolean; hasChatRoute: boolean; hasEmbeddingRoute: boolean }> {
  const routing = await getConnectStageRouting(args.workspaceId);
  if (!routing?.project_id) {
    return evaluateConnectModelsReady({
      stageRows: [],
      integrationsCount: args.integrationsCount,
      llmReady: args.llmReady,
      hasProjectRouting: false,
    });
  }

  let environmentId = routing.environment_id?.trim();
  if (!environmentId) {
    const envs = await listEnvironments(routing.project_id, args.userId);
    environmentId = envs[0]?.id;
  }
  if (!environmentId) {
    return { modelsReady: false, hasChatRoute: false, hasEmbeddingRoute: false };
  }

  const stageRows = await listConnectStageRouteRows({
    workspaceId: args.workspaceId,
    userId: args.userId,
    projectId: routing.project_id,
    environmentId,
    dashboardBase: args.dashboardBase,
  });

  return evaluateConnectModelsReady({
    stageRows,
    integrationsCount: args.integrationsCount,
    llmReady: args.llmReady,
    hasProjectRouting: true,
  });
}

export type ConnectValidationRouteOption = {
  id: string;
  name: string;
  isDefault: boolean;
  visualHref: string;
  activeModel: { modelId: string; provider: string } | null;
};

const DASHBOARD_BASE = "/keys/dashboard";

async function toConnectValidationRouteOption(args: {
  route: RouteRecord;
  projectId: string;
  userId: string;
  isDefault: boolean;
}): Promise<ConnectValidationRouteOption> {
  const visualHref = `${DASHBOARD_BASE}/projects/${args.projectId}/routes/${args.route.id}?flow=visual`;
  let activeModel: { modelId: string; provider: string } | null = null;
  try {
    const resolved = await resolvePrimaryStepModel({
      routeId: args.route.id,
      projectId: args.projectId,
      userId: args.userId,
    });
    if (resolved?.modelId && resolved.provider) {
      activeModel = { modelId: resolved.modelId, provider: resolved.provider };
    }
  } catch {
    activeModel = null;
  }
  return {
    id: args.route.id,
    name: args.route.name,
    isDefault: args.isDefault,
    visualHref,
    activeModel,
  };
}

/** Published ingestion routes suitable for the validation stage picker. */
export async function listConnectIngestionValidationRoutes(args: {
  workspaceId: string;
  userId: string;
  projectId: string;
  environmentId: string;
}): Promise<ConnectValidationRouteOption[]> {
  const routing = (await getConnectStageRouting(args.workspaceId)) ?? {
    project_id: args.projectId,
    environment_id: args.environmentId,
  };
  const defaultRouteId = routing.routes?.validation ?? null;
  const dedicated = await listRoutes(args.projectId, args.userId, {
    environmentId: args.environmentId,
    workload: INGESTION_WORKLOAD,
    stage: CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE.validation,
  });
  const shared = await listRoutes(args.projectId, args.userId, {
    environmentId: args.environmentId,
    workload: INGESTION_WORKLOAD,
  });

  const seen = new Set<string>();
  const options: ConnectValidationRouteOption[] = [];
  const candidates = [...dedicated, ...shared.filter((r) => !r.stage || r.stage === "")];
  for (const route of candidates) {
    if (seen.has(route.id)) continue;
    if (route.status !== "active" || !(route.enabled ?? true) || !isRoutePublished(route)) continue;
    seen.add(route.id);
    options.push(
      await toConnectValidationRouteOption({
        route,
        projectId: args.projectId,
        userId: args.userId,
        isDefault: route.id === defaultRouteId,
      }),
    );
  }
  options.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return options;
}

/** Published ingestion routes suitable for the embedding stage picker. */
export async function listConnectIngestionEmbeddingRoutes(args: {
  workspaceId: string;
  userId: string;
  projectId: string;
  environmentId: string;
}): Promise<ConnectValidationRouteOption[]> {
  const routing = (await getConnectStageRouting(args.workspaceId)) ?? {
    project_id: args.projectId,
    environment_id: args.environmentId,
  };
  const defaultRouteId = routing.routes?.embedding ?? null;
  const dedicated = await listRoutes(args.projectId, args.userId, {
    environmentId: args.environmentId,
    workload: INGESTION_WORKLOAD,
    stage: CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE.embedding,
  });
  const shared = await listRoutes(args.projectId, args.userId, {
    environmentId: args.environmentId,
    workload: INGESTION_WORKLOAD,
  });

  const seen = new Set<string>();
  const options: ConnectValidationRouteOption[] = [];
  const candidates = [...dedicated, ...shared.filter((r) => !r.stage || r.stage === "")];
  for (const route of candidates) {
    if (seen.has(route.id)) continue;
    if (route.status !== "active" || !(route.enabled ?? true) || !isRoutePublished(route)) continue;
    seen.add(route.id);
    options.push(
      await toConnectValidationRouteOption({
        route,
        projectId: args.projectId,
        userId: args.userId,
        isDefault: route.id === defaultRouteId,
      }),
    );
  }
  options.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return options;
}

/** Published ingestion routes suitable for the remediation stage picker. */
export async function listConnectIngestionRemediationRoutes(args: {
  workspaceId: string;
  userId: string;
  projectId: string;
  environmentId: string;
}): Promise<ConnectValidationRouteOption[]> {
  const routing = (await getConnectStageRouting(args.workspaceId)) ?? {
    project_id: args.projectId,
    environment_id: args.environmentId,
  };
  const defaultRouteId = routing.routes?.remediation ?? null;
  const dedicated = await listRoutes(args.projectId, args.userId, {
    environmentId: args.environmentId,
    workload: INGESTION_WORKLOAD,
    stage: CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE.remediation,
  });
  const shared = await listRoutes(args.projectId, args.userId, {
    environmentId: args.environmentId,
    workload: INGESTION_WORKLOAD,
  });

  const seen = new Set<string>();
  const options: ConnectValidationRouteOption[] = [];
  const candidates = [...dedicated, ...shared.filter((r) => !r.stage || r.stage === "")];
  for (const route of candidates) {
    if (seen.has(route.id)) continue;
    if (route.status !== "active" || !(route.enabled ?? true) || !isRoutePublished(route)) continue;
    seen.add(route.id);
    options.push(
      await toConnectValidationRouteOption({
        route,
        projectId: args.projectId,
        userId: args.userId,
        isDefault: route.id === defaultRouteId,
      }),
    );
  }
  options.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return options;
}

/** Worker context: workspace owner as userId when no session. */
export async function resolveKnowledgeRouteExecutionContextForWorker(args: {
  workspaceId: string;
  projectId?: string | null;
}): Promise<ConnectRouteExecutionContext | null> {
  const ws = await getWorkspace(args.workspaceId);
  if (!ws?.ownerUserId) return null;
  return resolveKnowledgeRouteExecutionContext({
    workspaceId: args.workspaceId,
    userId: ws.ownerUserId,
    projectId: args.projectId,
  });
}
