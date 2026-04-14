import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRouteRow } = vi.hoisted(() => ({
  mockRouteRow: {
    id: "r1",
    name: "ingestion",
    projectId: "p1",
    environmentId: "env-1",
    status: "active",
    enabled: true,
    version: 1,
    publishedVersion: 1,
    workload: null as string | null,
    stage: null as string | null,
  },
}));

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getRoute: vi.fn().mockResolvedValue(null),
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue({
    id: "ws1",
    name: "Default",
    slug: "default",
    ownerUserId: "u1",
    createdAt: 0,
    plan: "free",
    planExpiresAt: null,
  }),
  listRoutes: vi.fn().mockResolvedValue([mockRouteRow]),
  listRouteStepEdges: vi.fn().mockResolvedValue([]),
  evaluatePolicies: vi.fn().mockResolvedValue([]),
  getModelsLifecycleByIds: vi.fn().mockResolvedValue([]),
  getRouteWithSteps: vi.fn().mockResolvedValue({
    route: { id: "r1", name: "ingestion", defaultModelId: "gpt-4o", environmentId: "env-1", version: 1, publishedVersion: 1 },
    steps: [
      {
        id: "s2",
        routeId: "r1",
        orderIndex: 1,
        providerPreference: "openai",
        modelId: "gpt-4o",
        conditionBlock: null,
        fallbackOn: "error",
        timeoutMs: null,
        enabled: true,
        switchCriteria: { advanceOn: ["rate_limit"] },
        retryPolicy: { retryOn: ["timeout"] },
        createdAt: new Date(1).toISOString(),
        updatedAt: new Date(1).toISOString(),
      },
      {
        id: "s1",
        routeId: "r1",
        orderIndex: 0,
        providerPreference: "anthropic",
        modelId: "claude-sonnet-4",
        conditionBlock: null,
        fallbackOn: "error",
        timeoutMs: null,
        enabled: true,
        createdAt: new Date(1).toISOString(),
        updatedAt: new Date(1).toISOString(),
      },
    ],
  }),
}));

describe("resolveRouteForExecution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects the lowest orderIndex enabled step", async () => {
    const { resolveRouteForExecution } = await import("./route-resolver");
    const res = await resolveRouteForExecution("p1", "env-1", "u1");
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.result.selectedStep?.id).toBe("s1");
    expect(res.result.providerType).toBe("anthropic");
    const s2row = res.result.stepChain?.find((r) => r.stepId === "s2");
    expect(s2row?.advanceOn).toEqual(["rate_limit"]);
    expect(s2row?.retryOn).toEqual(["timeout"]);
  });

  it("skips disabled steps", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getRouteWithSteps).mockResolvedValueOnce({
      route: { id: "r1", defaultModelId: "gpt-4o" },
      steps: [
        {
          id: "s1",
          routeId: "r1",
          orderIndex: 0,
          providerPreference: "anthropic",
          modelId: "claude-sonnet-4",
          conditionBlock: null,
          fallbackOn: "error",
          timeoutMs: null,
          enabled: false,
          createdAt: new Date(1).toISOString(),
          updatedAt: new Date(1).toISOString(),
        },
        {
          id: "s2",
          routeId: "r1",
          orderIndex: 1,
          providerPreference: "openai",
          modelId: "gpt-4o",
          conditionBlock: null,
          fallbackOn: "error",
          timeoutMs: null,
          enabled: true,
          createdAt: new Date(1).toISOString(),
          updatedAt: new Date(1).toISOString(),
        },
      ],
    } as any);

    const { resolveRouteForExecution } = await import("./route-resolver");
    const res = await resolveRouteForExecution("p1", "env-1", "u1");
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.result.selectedStep?.id).toBe("s2");
  });

  it("emits canonical vertex for stored google provider preference", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getRouteWithSteps).mockResolvedValueOnce({
      route: { id: "r1", name: "ingestion", defaultModelId: "gemini-pro", environmentId: "env-1", version: 1, publishedVersion: 1 },
      steps: [
        {
          id: "sg",
          routeId: "r1",
          orderIndex: 0,
          providerPreference: "google",
          modelId: "gemini-pro",
          conditionBlock: null,
          fallbackOn: "error",
          timeoutMs: null,
          enabled: true,
          createdAt: new Date(1).toISOString(),
          updatedAt: new Date(1).toISOString(),
        },
      ],
    } as any);

    const { resolveRouteForExecution } = await import("./route-resolver");
    const res = await resolveRouteForExecution("p1", "env-1", "u1");
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.result.providerType).toBe("vertex");
  });

  it("returns resolve_incomplete when policy passes but step has no model", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getRouteWithSteps).mockResolvedValueOnce({
      route: { id: "r1", name: "ingestion", defaultModelId: null, environmentId: "env-1", version: 1, publishedVersion: 1 },
      steps: [
        {
          id: "sb",
          routeId: "r1",
          orderIndex: 0,
          providerPreference: "openai",
          modelId: null,
          conditionBlock: null,
          fallbackOn: "error",
          timeoutMs: null,
          enabled: true,
          createdAt: new Date(1).toISOString(),
          updatedAt: new Date(1).toISOString(),
        },
      ],
    } as any);

    const { resolveRouteForExecution } = await import("./route-resolver");
    const res = await resolveRouteForExecution("p1", "env-1", "u1");
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.failure.code).toBe("resolve_incomplete");
  });

  it("selects voyage first in a mixed voyage → google → anthropic chain", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getRouteWithSteps).mockResolvedValueOnce({
      route: { id: "r1", name: "ingestion", defaultModelId: null, environmentId: "env-1", version: 1, publishedVersion: 1 },
      steps: [
        {
          id: "sv",
          routeId: "r1",
          orderIndex: 0,
          providerPreference: "voyage",
          modelId: "voyage-3",
          conditionBlock: null,
          fallbackOn: "error",
          timeoutMs: null,
          enabled: true,
          createdAt: new Date(1).toISOString(),
          updatedAt: new Date(1).toISOString(),
        },
        {
          id: "sg",
          routeId: "r1",
          orderIndex: 1,
          providerPreference: "google",
          modelId: "gemini-2.5-flash",
          conditionBlock: null,
          fallbackOn: "error",
          timeoutMs: null,
          enabled: true,
          createdAt: new Date(1).toISOString(),
          updatedAt: new Date(1).toISOString(),
        },
        {
          id: "sa",
          routeId: "r1",
          orderIndex: 2,
          providerPreference: "anthropic",
          modelId: "claude-sonnet-4",
          conditionBlock: null,
          fallbackOn: "error",
          timeoutMs: null,
          enabled: true,
          createdAt: new Date(1).toISOString(),
          updatedAt: new Date(1).toISOString(),
        },
      ],
    } as any);

    const { resolveRouteForExecution } = await import("./route-resolver");
    const res = await resolveRouteForExecution("p1", "env-1", "u1");
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.result.selectedStepId).toBe("sv");
    expect(res.result.providerType).toBe("voyage");
    expect(res.result.modelId).toBe("voyage-3");
    const chain = res.result.stepChain ?? [];
    expect(chain.map((c) => c.stepId)).toEqual(["sv", "sg", "sa"]);
    expect(chain[0]?.selected).toBe(true);
    const fallbacks = res.result.fallbackCandidates ?? [];
    expect(fallbacks.map((f) => f.stepId)).toEqual(["sg", "sa"]);
    expect(fallbacks[0]?.providerType).toBe("vertex");
    expect(fallbacks[1]?.providerType).toBe("anthropic");
  });
});
