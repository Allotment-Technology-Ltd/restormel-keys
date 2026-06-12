/**
 * Stage R7 (decision D4): "Workspace infrastructure" routing project.
 *
 * Covers the stage's three acceptance areas:
 *  1. provisioning idempotency — cold workspace provisions once; repeat calls no-op;
 *  2. default-selection precedence — an existing routing config (custom or not)
 *     always wins and is never rewritten (additive default only, no migration);
 *  3. ledger-row data — "Routing project: Workspace infrastructure — change".
 *
 * Deps are injected — no module mocking needed for behavior; the default-deps
 * imports are mocked so the module loads hermetically.
 */
import { describe, it, expect, vi } from "vitest";

// The module's default deps import the real data layer — mock them so this unit
// test stays hermetic (every call site under test passes injected deps).
vi.mock("$lib/server/db", () => ({
  ensureConnectInfrastructureProject: vi.fn(),
  getConnectInfrastructureProjectId: vi.fn(),
  getProject: vi.fn(),
  listEnvironments: vi.fn(),
  listProviderIntegrations: vi.fn(),
  CONNECT_INFRASTRUCTURE_PROJECT_NAME: "Workspace infrastructure",
}));
vi.mock("$lib/server/neon", () => ({
  getConnectStageRoutingConfig: vi.fn(),
  upsertConnectStageRoutingConfig: vi.fn(),
}));
vi.mock("$lib/server/connect/stage-routing", () => ({
  getConnectStageRouting: vi.fn(),
}));
vi.mock("$lib/server/connect/apply-recommended-routes", () => ({
  applyRecommendedIngestionRoutes: vi.fn(),
}));

import {
  ensureWorkspaceInfrastructureRouting,
  getRoutingProjectLedgerRow,
  CONNECT_INFRASTRUCTURE_PROJECT_NAME,
  type WorkspaceInfrastructureDeps,
} from "./workspace-infrastructure";

const WS = "ws-1";
const USER = "user-1";
const INFRA_PROJECT = {
  id: "proj-infra",
  name: CONNECT_INFRASTRUCTURE_PROJECT_NAME,
  userId: USER,
  workspaceId: WS,
  createdAt: 0,
};
const DEV_ENV = { id: "env-dev", projectId: "proj-infra", name: "Development", type: "dev", createdAt: 0 };
const PROD_ENV = { id: "env-prod", projectId: "proj-infra", name: "Production", type: "prod", createdAt: 0 };

function integration(over: Record<string, unknown> = {}) {
  return {
    id: "int-openai",
    providerType: "openai",
    status: "active",
    hasEncryptedCredential: true,
    ...over,
  };
}

type FakeState = {
  /** The shared routing-config blob (graph target, pack keys live here too). */
  config: Record<string, unknown> | null;
  integrations: ReturnType<typeof integration>[];
  infraProjectId: string | null;
  applyResult?: { applied: unknown[]; skipped: unknown[]; catalogSynced: boolean };
  applyThrows?: boolean;
  environments?: { id: string; type: string }[];
  projectName?: string | null;
};

/**
 * Stateful fake deps: routing config reads/writes go through `state.config`, so a
 * second ensure call observes the first call's upsert (real idempotency, not just
 * mock choreography).
 */
function makeDeps(state: FakeState) {
  const ensureProject = vi.fn(async () => {
    state.infraProjectId = INFRA_PROJECT.id;
    return INFRA_PROJECT;
  });
  const upsert = vi.fn(async (_ws: string, config: unknown) => {
    state.config = config as Record<string, unknown>;
  });
  const apply = vi.fn(async () => {
    if (state.applyThrows) throw new Error("apply failed");
    return state.applyResult ?? { applied: [], skipped: [], catalogSynced: false };
  });
  const deps = {
    getConnectStageRouting: vi.fn(async () =>
      state.config && typeof state.config.project_id === "string" ? state.config : null,
    ),
    getConnectStageRoutingConfig: vi.fn(async () => state.config),
    upsertConnectStageRoutingConfig: upsert,
    ensureConnectInfrastructureProject: ensureProject,
    getConnectInfrastructureProjectId: vi.fn(async () => state.infraProjectId),
    getProject: vi.fn(async (projectId: string) =>
      state.projectName === null
        ? null
        : { ...INFRA_PROJECT, id: projectId, name: state.projectName ?? INFRA_PROJECT.name },
    ),
    listEnvironments: vi.fn(async () => state.environments ?? [DEV_ENV, PROD_ENV]),
    listProviderIntegrations: vi.fn(async () => state.integrations),
    applyRecommendedIngestionRoutes: apply,
  } as unknown as WorkspaceInfrastructureDeps;
  return { deps, ensureProject, upsert, apply };
}

const ARGS = { workspaceId: WS, userId: USER, actorType: "session" };

describe("ensureWorkspaceInfrastructureRouting — provisioning", () => {
  it("cold workspace: provisions the project, sets it as the routing default (dev env), no routes without an executable provider", async () => {
    const state: FakeState = { config: null, integrations: [], infraProjectId: null };
    const { deps, ensureProject, upsert, apply } = makeDeps(state);

    const result = await ensureWorkspaceInfrastructureRouting(ARGS, deps);

    expect(result).toEqual({
      provisioned: true,
      reason: "provisioned",
      projectId: "proj-infra",
      environmentId: "env-dev",
      routesApplied: 0,
    });
    expect(ensureProject).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(WS, {
      project_id: "proj-infra",
      environment_id: "env-dev",
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("merges into the shared config blob — graph-target/pack keys survive provisioning", async () => {
    const state: FakeState = {
      // A blob with non-routing keys but no project routing (e.g. store connected first).
      config: { active_graph_target_id: "gt-1", default_domain_pack_id: "pack-1" },
      integrations: [],
      infraProjectId: null,
    };
    const { deps } = makeDeps(state);

    await ensureWorkspaceInfrastructureRouting(ARGS, deps);

    expect(state.config).toEqual({
      active_graph_target_id: "gt-1",
      default_domain_pack_id: "pack-1",
      project_id: "proj-infra",
      environment_id: "env-dev",
    });
  });

  it("composes K3's apply-recommended (routes + ensured bindings) when an executable provider exists", async () => {
    const state: FakeState = {
      config: null,
      integrations: [integration()],
      infraProjectId: null,
      applyResult: {
        applied: [{ stage: "extraction" }, { stage: "embedding" }],
        skipped: [],
        catalogSynced: true,
      },
    };
    const { deps, apply } = makeDeps(state);

    const result = await ensureWorkspaceInfrastructureRouting(ARGS, deps);

    expect(apply).toHaveBeenCalledWith({
      workspaceId: WS,
      userId: USER,
      projectId: "proj-infra",
      environmentId: "env-dev",
      actorType: "session",
    });
    expect(result.routesApplied).toBe(2);
    expect(result.provisioned).toBe(true);
  });

  it("does not call apply-recommended for reference-only or inactive integrations (nothing executable)", async () => {
    const state: FakeState = {
      config: null,
      integrations: [
        integration({ hasEncryptedCredential: false }),
        integration({ id: "int-2", status: "disabled" }),
      ],
      infraProjectId: null,
    };
    const { deps, apply } = makeDeps(state);

    const result = await ensureWorkspaceInfrastructureRouting(ARGS, deps);

    expect(apply).not.toHaveBeenCalled();
    expect(result.routesApplied).toBe(0);
    expect(result.provisioned).toBe(true);
  });

  it("route-wiring failure never blocks provisioning (config still set; preflight gates later)", async () => {
    const state: FakeState = {
      config: null,
      integrations: [integration()],
      infraProjectId: null,
      applyThrows: true,
    };
    const { deps } = makeDeps(state);

    const result = await ensureWorkspaceInfrastructureRouting(ARGS, deps);

    expect(result.provisioned).toBe(true);
    expect(result.routesApplied).toBe(0);
    expect(state.config).toMatchObject({ project_id: "proj-infra" });
  });

  it("returns no_environment (and writes no config) when the project has no environments", async () => {
    const state: FakeState = { config: null, integrations: [], infraProjectId: null, environments: [] };
    const { deps, upsert } = makeDeps(state);

    const result = await ensureWorkspaceInfrastructureRouting(ARGS, deps);

    expect(result).toMatchObject({ provisioned: false, reason: "no_environment", projectId: "proj-infra" });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("ensureWorkspaceInfrastructureRouting — idempotency + precedence", () => {
  it("is idempotent: the second flow entry is a no-op (no second project ensure, no config rewrite)", async () => {
    const state: FakeState = { config: null, integrations: [], infraProjectId: null };
    const { deps, ensureProject, upsert } = makeDeps(state);

    const first = await ensureWorkspaceInfrastructureRouting(ARGS, deps);
    const second = await ensureWorkspaceInfrastructureRouting(ARGS, deps);

    expect(first.provisioned).toBe(true);
    expect(second).toEqual({
      provisioned: false,
      reason: "existing_routing",
      projectId: "proj-infra",
      environmentId: "env-dev",
      routesApplied: 0,
    });
    expect(ensureProject).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("default-selection precedence: an existing custom routing config wins and is untouched", async () => {
    const customConfig = {
      project_id: "proj-custom",
      environment_id: "env-custom",
      routes: { extraction: "route-1" },
    };
    const state: FakeState = { config: { ...customConfig }, integrations: [integration()], infraProjectId: null };
    const { deps, ensureProject, upsert, apply } = makeDeps(state);

    const result = await ensureWorkspaceInfrastructureRouting(ARGS, deps);

    expect(result).toEqual({
      provisioned: false,
      reason: "existing_routing",
      projectId: "proj-custom",
      environmentId: "env-custom",
      routesApplied: 0,
    });
    // The trap R7 removes is created nowhere else: no project, no write, no apply.
    expect(ensureProject).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(state.config).toEqual(customConfig);
  });

  it("prefers the dev environment but falls back to the first environment", async () => {
    const state: FakeState = {
      config: null,
      integrations: [],
      infraProjectId: null,
      environments: [PROD_ENV],
    };
    const { deps } = makeDeps(state);

    const result = await ensureWorkspaceInfrastructureRouting(ARGS, deps);

    expect(result.environmentId).toBe("env-prod");
  });
});

describe("getRoutingProjectLedgerRow — ledger-row data", () => {
  it("names the provisioned project with a change affordance: 'Routing project: Workspace infrastructure — change'", async () => {
    const state: FakeState = {
      config: { project_id: "proj-infra", environment_id: "env-dev" },
      integrations: [],
      infraProjectId: "proj-infra",
    };
    const { deps } = makeDeps(state);

    const row = await getRoutingProjectLedgerRow(
      { workspaceId: WS, userId: USER, dashboardBase: "/keys/dashboard" },
      deps,
    );

    expect(row).toEqual({
      id: "routing_project",
      label: "Routing project",
      status: "ready",
      projectId: "proj-infra",
      projectName: "Workspace infrastructure",
      isInfrastructure: true,
      summary: "Routing project: Workspace infrastructure",
      changeHref: "/keys/dashboard/connect/models",
      changeLabel: "Change",
    });
  });

  it("names a custom routing project without claiming it is the infrastructure project", async () => {
    const state: FakeState = {
      config: { project_id: "proj-custom", environment_id: "env-custom" },
      integrations: [],
      infraProjectId: "proj-infra",
      projectName: "My own project",
    };
    const { deps } = makeDeps(state);

    const row = await getRoutingProjectLedgerRow({ workspaceId: WS, userId: USER }, deps);

    expect(row.status).toBe("ready");
    expect(row.projectId).toBe("proj-custom");
    expect(row.projectName).toBe("My own project");
    expect(row.isInfrastructure).toBe(false);
    expect(row.summary).toBe("Routing project: My own project");
  });

  it("reports an honest absent state when no routing config exists", async () => {
    const state: FakeState = { config: null, integrations: [], infraProjectId: null };
    const { deps } = makeDeps(state);

    const row = await getRoutingProjectLedgerRow(
      { workspaceId: WS, userId: USER, dashboardBase: "/keys/dashboard" },
      deps,
    );

    expect(row).toMatchObject({
      status: "absent",
      projectId: null,
      projectName: null,
      isInfrastructure: false,
      summary: "Routing project: not set",
      changeHref: "/keys/dashboard/connect/models",
    });
  });

  it("degrades to 'Unknown project' when the project row cannot be read (never throws)", async () => {
    const state: FakeState = {
      config: { project_id: "proj-gone", environment_id: "env-1" },
      integrations: [],
      infraProjectId: null,
      projectName: null,
    };
    const { deps } = makeDeps(state);

    const row = await getRoutingProjectLedgerRow({ workspaceId: WS, userId: USER }, deps);

    expect(row.status).toBe("ready");
    expect(row.projectName).toBeNull();
    expect(row.summary).toBe("Routing project: Unknown project");
  });
});
