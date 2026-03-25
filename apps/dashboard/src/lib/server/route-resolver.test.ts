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
        createdAt: new Date(1).toISOString(),
        updatedAt: new Date(1).toISOString(),
      },
      {
        id: "s1",
        routeId: "r1",
        orderIndex: 0,
        providerPreference: "anthropic",
        modelId: "claude-3-5-sonnet",
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
          modelId: "claude-3-5-sonnet",
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
});
