/**
 * Stage R7 (decision D4): the Connect-owned "Workspace infrastructure" routing project.
 *
 * Removes the last coincidence on the golden path (KEYS §1.4 / K-P0-2): Connect's
 * routing project used to be whichever project the user happened to have — often the
 * auto-provisioned Testing project, where bindings exist only by bootstrap accident.
 *
 * On first flow entry, when the workspace has NO stage-routing config yet
 * (`getConnectStageRouting` → null), this module:
 *   1. ensures the flagged "Workspace infrastructure" project exists
 *      (mirroring testing-bootstrap / ensureRestormelTestingProject — idempotent);
 *   2. sets it as the routing config's default project + environment (merging into
 *      the shared config blob, preserving graph-target/domain-pack keys);
 *   3. composes K3's machinery — applyRecommendedIngestionRoutes wires the stage
 *      routes AND ensures provider bindings (ensureProviderBindingsForProviders)
 *      when the workspace already has an executable provider. NOT duplicated here.
 *
 * Existing workspaces with a routing config are UNTOUCHED — additive default only,
 * no migration of existing setups.
 *
 * The ledger-row helper exposes the named project + change affordance as reusable
 * data ("Routing project: Workspace infrastructure — change") for K3's readiness /
 * K4's ledger / R3's Home masthead to render.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  ensureConnectInfrastructureProject,
  getConnectInfrastructureProjectId,
  getProject,
  listEnvironments,
  listProviderIntegrations,
  CONNECT_INFRASTRUCTURE_PROJECT_NAME,
} from "$lib/server/db";
import {
  getConnectStageRoutingConfig,
  upsertConnectStageRoutingConfig,
} from "$lib/server/neon";
import { getConnectStageRouting } from "$lib/server/connect/stage-routing";
import { applyRecommendedIngestionRoutes } from "$lib/server/connect/apply-recommended-routes";

export { CONNECT_INFRASTRUCTURE_PROJECT_NAME };

export type WorkspaceInfrastructureDeps = {
  getConnectStageRouting: typeof getConnectStageRouting;
  getConnectStageRoutingConfig: typeof getConnectStageRoutingConfig;
  upsertConnectStageRoutingConfig: typeof upsertConnectStageRoutingConfig;
  ensureConnectInfrastructureProject: typeof ensureConnectInfrastructureProject;
  getConnectInfrastructureProjectId: typeof getConnectInfrastructureProjectId;
  getProject: typeof getProject;
  listEnvironments: typeof listEnvironments;
  listProviderIntegrations: typeof listProviderIntegrations;
  applyRecommendedIngestionRoutes: typeof applyRecommendedIngestionRoutes;
};

const defaultDeps: WorkspaceInfrastructureDeps = {
  getConnectStageRouting,
  getConnectStageRoutingConfig,
  upsertConnectStageRoutingConfig,
  ensureConnectInfrastructureProject,
  getConnectInfrastructureProjectId,
  getProject,
  listEnvironments,
  listProviderIntegrations,
  applyRecommendedIngestionRoutes,
};

export type EnsureWorkspaceInfrastructureResult = {
  /** True only when this call established the routing default (cold workspace). */
  provisioned: boolean;
  reason: "existing_routing" | "provisioned" | "no_environment";
  projectId: string | null;
  environmentId: string | null;
  /**
   * Stage routes wired by the composed K3 apply (0 when the workspace has no
   * executable provider yet — apply-recommended fires later from connect/models
   * and targets this project by default via the routing config).
   */
  routesApplied: number;
};

/**
 * First-flow-entry provisioning (idempotent). Precedence is strictly additive:
 * an existing routing config — custom or otherwise — always wins and is never
 * rewritten; only the "routing config absent" workspace gets the default.
 */
export async function ensureWorkspaceInfrastructureRouting(
  args: {
    workspaceId: string;
    userId: string;
    actorType?: string;
  },
  deps: WorkspaceInfrastructureDeps = defaultDeps,
): Promise<EnsureWorkspaceInfrastructureResult> {
  // Default-selection precedence: any existing project routing wins, untouched.
  const routing = await deps.getConnectStageRouting(args.workspaceId);
  if (routing?.project_id) {
    return {
      provisioned: false,
      reason: "existing_routing",
      projectId: routing.project_id,
      environmentId: routing.environment_id ?? null,
      routesApplied: 0,
    };
  }

  const project = await deps.ensureConnectInfrastructureProject(args.userId);
  const envs = await deps.listEnvironments(project.id, args.userId);
  const environment = envs.find((e) => e.type === "dev") ?? envs[0] ?? null;
  if (!environment) {
    return {
      provisioned: false,
      reason: "no_environment",
      projectId: project.id,
      environmentId: null,
      routesApplied: 0,
    };
  }

  // The routing config row is a shared blob (active graph target, domain pack,
  // document selection live alongside project routing) — merge, never replace.
  const raw = await deps.getConnectStageRoutingConfig(args.workspaceId);
  const existing =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  await deps.upsertConnectStageRoutingConfig(args.workspaceId, {
    ...existing,
    project_id: project.id,
    environment_id: environment.id,
  });

  // Compose K3 (never duplicate it): when an executable provider already exists,
  // applyRecommendedIngestionRoutes creates/publishes the stage routes AND ensures
  // provider bindings on this project. Best-effort — route wiring failure never
  // blocks flow entry; the launch preflight (K3) still gates the run honestly.
  let routesApplied = 0;
  const integrations = await deps
    .listProviderIntegrations(args.workspaceId)
    .catch(() => []);
  const executable = integrations.filter(
    (i) => i.hasEncryptedCredential === true && i.status === "active",
  );
  if (executable.length > 0) {
    const applied = await deps
      .applyRecommendedIngestionRoutes({
        workspaceId: args.workspaceId,
        userId: args.userId,
        projectId: project.id,
        environmentId: environment.id,
        actorType: args.actorType ?? "session",
      })
      .catch(() => null);
    routesApplied = applied?.applied.length ?? 0;
  }

  return {
    provisioned: true,
    reason: "provisioned",
    projectId: project.id,
    environmentId: environment.id,
    routesApplied,
  };
}

/**
 * Reusable ledger-row data for the readiness surfaces: "Routing project:
 * Workspace infrastructure — change". Consumed by the Connect hub payload today;
 * K3's readiness / K4's ledger / R3's Home masthead render it.
 */
export type RoutingProjectLedgerRow = {
  id: "routing_project";
  label: "Routing project";
  status: "ready" | "absent";
  projectId: string | null;
  /** Project display name — "Workspace infrastructure" for the provisioned default. */
  projectName: string | null;
  /** True when the routing project is the auto-provisioned Connect-owned project. */
  isInfrastructure: boolean;
  /** Render-ready summary, e.g. "Routing project: Workspace infrastructure". */
  summary: string;
  /** Change affordance: the connect/models page owns the project/env binding picker. */
  changeHref: string;
  changeLabel: "Change";
};

export async function getRoutingProjectLedgerRow(
  args: {
    workspaceId: string;
    userId: string;
    dashboardBase?: string;
  },
  deps: WorkspaceInfrastructureDeps = defaultDeps,
): Promise<RoutingProjectLedgerRow> {
  const base = args.dashboardBase ?? DASHBOARD_BASE;
  const changeHref = `${base}/connect/models`;

  const routing = await deps.getConnectStageRouting(args.workspaceId);
  if (!routing?.project_id) {
    return {
      id: "routing_project",
      label: "Routing project",
      status: "absent",
      projectId: null,
      projectName: null,
      isInfrastructure: false,
      summary: "Routing project: not set",
      changeHref,
      changeLabel: "Change",
    };
  }

  const [project, infrastructureProjectId] = await Promise.all([
    deps.getProject(routing.project_id, args.userId).catch(() => null),
    deps.getConnectInfrastructureProjectId(args.workspaceId).catch(() => null),
  ]);

  const projectName = project?.name ?? null;
  return {
    id: "routing_project",
    label: "Routing project",
    status: "ready",
    projectId: routing.project_id,
    projectName,
    isInfrastructure:
      infrastructureProjectId !== null && routing.project_id === infrastructureProjectId,
    summary: `Routing project: ${projectName ?? "Unknown project"}`,
    changeHref,
    changeLabel: "Change",
  };
}
