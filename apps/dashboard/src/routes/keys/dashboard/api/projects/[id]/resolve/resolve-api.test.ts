/**
 * Resolve API: request execution path (Gateway Key / session → route resolution → log).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockProject = {
  id: "p1",
  name: "Proj",
  userId: "u1",
  workspaceId: "ws1",
  createdAt: 1,
};

const mockRoute = {
  id: "route-1",
  projectId: "p1",
  environmentId: "env-1",
  name: "Default",
  description: null,
  defaultModelId: "gpt-4o",
  billingMode: null,
  routeMode: null,
  workload: null as string | null,
  stage: null as string | null,
  enabled: true,
  version: 1,
  publishedVersion: 1,
  status: "active",
  createdBy: "u1",
  createdAt: 1,
  updatedAt: 1,
};

const mockStep = {
  id: "step-1",
  routeId: "route-1",
  orderIndex: 0,
  providerPreference: "openai",
  modelId: "gpt-4o",
  conditionBlock: null,
  fallbackOn: null,
  timeoutMs: null,
  enabled: true,
  createdAt: new Date(1).toISOString(),
  updatedAt: new Date(1).toISOString(),
};

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue(mockProject),
  getProjectInWorkspace: vi.fn(),
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue({
    id: "ws1",
    name: "Default",
    slug: "default",
    ownerUserId: "u1",
    createdAt: 0,
    plan: "free",
    planExpiresAt: null,
  }),
  insertRequestLog: vi.fn().mockResolvedValue(undefined),
  downgradeWorkspaceIfProExpired: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("$lib/server/route-resolver", () => ({
  resolveRouteForExecution: vi.fn(),
}));

async function getHandler() {
  const mod = await import("./+server");
  return mod.POST;
}

function mockEvent(body: { environmentId: string; routeId?: string }) {
  return {
    params: { id: "p1" },
    request: new Request("http://localhost/api/projects/p1/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    locals: { user: { uid: "u1" } },
  } as unknown as Parameters<Awaited<ReturnType<typeof getHandler>>>[0];
}

describe("POST /api/projects/[id]/resolve", () => {
  beforeEach(async () => {
    const { resolveRouteForExecution } = await import("$lib/server/route-resolver");
    vi.mocked(resolveRouteForExecution).mockReset();
  });

  it("returns 401 when user missing", async () => {
    const POST = await getHandler();
    const res = await POST({
      ...mockEvent({ environmentId: "env-1" }),
      locals: { user: undefined },
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when environmentId missing", async () => {
    const POST = await getHandler();
    const res = await POST({
      ...mockEvent({ environmentId: "" }),
      request: new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    } as Parameters<Awaited<ReturnType<typeof getHandler>>>[0]);
    expect(res.status).toBe(400);
  });

  it("returns 404 and logs when no route resolved", async () => {
    const { resolveRouteForExecution } = await import("$lib/server/route-resolver");
    const { insertRequestLog } = await import("$lib/server/db");
    vi.mocked(resolveRouteForExecution).mockResolvedValue({
      ok: false,
      failure: { code: "no_route", message: "No published route matched constraints" },
    });

    const POST = await getHandler();
    const res = await POST(mockEvent({ environmentId: "env-1" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("no_route");
    expect(insertRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        requestStatus: "no_route",
        providerType: "none",
      })
    );
  });

  it("returns 200 with route/provider/model and logs when resolved", async () => {
    const { resolveRouteForExecution } = await import("$lib/server/route-resolver");
    const { insertRequestLog } = await import("$lib/server/db");
    vi.mocked(resolveRouteForExecution).mockResolvedValue({
      ok: true,
      result: {
        workspaceId: "ws1",
        projectId: "p1",
        environmentId: "env-1",
        route: mockRoute,
        steps: [mockStep],
        selectedStep: mockStep,
        providerType: "openai",
        modelId: "gpt-4o",
        explanation: "route=route-1 step=0 provider=openai model=gpt-4o",
      },
    });

    const POST = await getHandler();
    const res = await POST(mockEvent({ environmentId: "env-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toMatchObject({
      routeId: "route-1",
      routeName: "Default",
      providerType: "openai",
      modelId: "gpt-4o",
      explanation: expect.any(String),
      contractVersion: "2026-03-26",
    });
    expect(insertRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: "route-1",
        providerType: "openai",
        finalModelId: "gpt-4o",
        requestStatus: "resolved",
      })
    );
  });

  it("returns 403 and violations when all steps blocked by policy", async () => {
    const { resolveRouteForExecution } = await import("$lib/server/route-resolver");
    const { insertRequestLog } = await import("$lib/server/db");
    const violations = [
      { policyId: "pol-1", policyName: "Allowlist", type: "model_allowlist", message: "Model x is not in allowlist" },
    ];
    vi.mocked(resolveRouteForExecution).mockResolvedValue({
      ok: true,
      result: {
        workspaceId: "ws1",
        projectId: "p1",
        environmentId: "env-1",
        route: mockRoute,
        steps: [mockStep],
        selectedStep: null,
        providerType: null,
        modelId: null,
        explanation: "route=route-1 all_steps_blocked_by_policy",
        policyViolations: violations,
      },
    });

    const POST = await getHandler();
    const res = await POST(mockEvent({ environmentId: "env-1" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("policy_blocked");
    expect(data.message).toContain("blocked by policy");
    expect(data.violations).toEqual(violations);
    expect(insertRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        requestStatus: "policy_blocked",
        providerType: "none",
      })
    );
  });

  it("returns 422 resolve_incomplete when resolver reports incomplete step", async () => {
    const { resolveRouteForExecution } = await import("$lib/server/route-resolver");
    const { insertRequestLog } = await import("$lib/server/db");
    vi.mocked(resolveRouteForExecution).mockResolvedValue({
      ok: false,
      failure: {
        code: "resolve_incomplete",
        routeId: "route-1",
        message: "A route step passed policy but has no executable providerType and modelId.",
      },
    });

    const POST = await getHandler();
    const res = await POST(mockEvent({ environmentId: "env-1" }));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toBe("resolve_incomplete");
    expect(data.userMessage).toContain("provider");
    expect(insertRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        requestStatus: "resolve_incomplete",
        providerType: "none",
      })
    );
  });

  it("returns providerType vertex when resolver returns google (normalized in payload)", async () => {
    const { resolveRouteForExecution } = await import("$lib/server/route-resolver");
    vi.mocked(resolveRouteForExecution).mockResolvedValue({
      ok: true,
      result: {
        workspaceId: "ws1",
        projectId: "p1",
        environmentId: "env-1",
        route: mockRoute,
        steps: [{ ...mockStep, providerPreference: "google" }],
        selectedStep: { ...mockStep, providerPreference: "google" },
        providerType: "google",
        modelId: "gpt-4o",
        explanation: "route=route-1 step=0 provider=google model=gpt-4o",
      },
    });

    const POST = await getHandler();
    const res = await POST(mockEvent({ environmentId: "env-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.providerType).toBe("vertex");
  });
});
