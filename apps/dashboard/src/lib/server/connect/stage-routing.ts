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
import { isRoutePublished } from "$lib/server/route-resolver";

export { CONNECT_MODEL_STAGES, CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE };
export type { ConnectModelStage, ConnectStageRouting };

export type ConnectRouteExecutionContext = {
  workspaceId: string;
  userId: string;
  projectId: string;
  environmentId: string;
  routing: ConnectStageRouting;
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
};

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
    options.push({
      id: route.id,
      name: route.name,
      isDefault: route.id === defaultRouteId,
    });
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
