import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue({ id: "p1", userId: "u1", workspaceId: "ws1" }),
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue({
    id: "ws1",
    name: "Default",
    slug: "default",
    ownerUserId: "u1",
    createdAt: 0,
    plan: "free",
    planExpiresAt: null,
  }),
  listRoutes: vi.fn().mockResolvedValue([{ id: "r1", name: "ingestion", status: "active" }]),
  getRouteWithSteps: vi.fn().mockResolvedValue({
    route: { id: "r1", name: "ingestion", defaultModelId: "gpt-4o" },
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
    expect(res?.selectedStep?.id).toBe("s1");
    expect(res?.providerType).toBe("anthropic");
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
    expect(res?.selectedStep?.id).toBe("s2");
  });
});
