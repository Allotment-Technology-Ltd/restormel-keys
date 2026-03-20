import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/db", () => ({
  getProjectInWorkspace: vi.fn(),
}));

vi.mock("$lib/server/route-resolver", () => ({
  resolveRouteForExecution: vi.fn(),
}));

vi.mock("@restormel/keys", () => ({
  defaultProviders: [{ id: "openai", models: ["gpt-4o"] }],
  estimateCost: vi.fn().mockReturnValue({ inputPerMillion: 5, outputPerMillion: 15 }),
}));

function mockEvent(
  body: Record<string, unknown>,
  locals: App.Locals = { user: { uid: "u1" } } as App.Locals
) {
  return {
    params: { id: "p1", routeId: "route-1" },
    request: new Request("http://localhost/api/projects/p1/routes/route-1/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    locals,
  } as any;
}

describe("POST /api/projects/[id]/routes/[routeId]/simulate", () => {
  beforeEach(async () => {
    const { resolveRouteForExecution } = await import("$lib/server/route-resolver");
    vi.mocked(resolveRouteForExecution).mockReset();
  });

  it("returns 401 when user missing", async () => {
    const { POST } = await import("./+server");
    const res = await POST(mockEvent({ environmentId: "env-1" }, { user: undefined } as App.Locals));
    expect(res.status).toBe(401);
  });

  it("returns 400 when environmentId missing", async () => {
    const { POST } = await import("./+server");
    const res = await POST(mockEvent({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no route resolved", async () => {
    const { resolveRouteForExecution } = await import("$lib/server/route-resolver");
    vi.mocked(resolveRouteForExecution).mockResolvedValue(null);
    const { POST } = await import("./+server");
    const res = await POST(mockEvent({ environmentId: "env-1" }));
    expect(res.status).toBe(404);
  });

  it("returns 200 with per-step estimate when resolved", async () => {
    const { resolveRouteForExecution } = await import("$lib/server/route-resolver");
    vi.mocked(resolveRouteForExecution).mockResolvedValue({
      workspaceId: "ws1",
      projectId: "p1",
      environmentId: "env-1",
      route: { id: "route-1", name: "Default" },
      steps: [
        { id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true },
      ],
      selectedStep: { id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true },
      selectedStepId: "s1",
      selectedOrderIndex: 0,
      switchReasonCode: null,
      providerType: "openai",
      modelId: "gpt-4o",
      explanation: "ok",
    });
    const { POST } = await import("./+server");
    const res = await POST(mockEvent({ environmentId: "env-1", estimatedInputTokens: 1000 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      selectedStepId: "s1",
      wouldRun: true,
    });
    expect(Array.isArray(body.data.perStepEstimates)).toBe(true);
    expect(body.data.perStepEstimates[0]).toMatchObject({
      stepId: "s1",
      modelId: "gpt-4o",
      wouldRun: true,
    });
  });
});

