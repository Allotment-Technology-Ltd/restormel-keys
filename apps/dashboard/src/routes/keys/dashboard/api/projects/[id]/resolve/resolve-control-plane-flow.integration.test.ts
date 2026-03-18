/**
 * End-to-end control-plane flow: resolve API with real route-resolver and mocked db.
 * Covers: project + environment → route resolution → provider/model → request log.
 * One full-path test to verify the chain works; db is mocked to avoid a real database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const PROJECT_ID = "proj-e2e";
const ENV_ID = "env-dev";
const USER_ID = "user-e2e";
const WORKSPACE_ID = "ws-e2e";
const ROUTE_ID = "route-e2e";

const mockProject = {
  id: PROJECT_ID,
  name: "E2E Project",
  userId: USER_ID,
  workspaceId: WORKSPACE_ID,
  createdAt: 1,
};

const mockRoute = {
  id: ROUTE_ID,
  projectId: PROJECT_ID,
  environmentId: ENV_ID,
  name: "Default",
  description: null,
  defaultModelId: "gpt-4o",
  billingMode: null,
  routeMode: null,
  status: "active",
  createdBy: USER_ID,
  createdAt: 1,
  updatedAt: 1,
};

const mockStep = {
  id: "step-e2e",
  routeId: ROUTE_ID,
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
  getProject: vi.fn(),
  getProjectInWorkspace: vi.fn(),
  getOrCreateDefaultWorkspace: vi.fn(),
  listRoutes: vi.fn(),
  getRouteWithSteps: vi.fn(),
  evaluatePolicies: vi.fn().mockResolvedValue([]),
  getModelsLifecycleByIds: vi.fn().mockResolvedValue([]),
  insertRequestLog: vi.fn().mockResolvedValue(undefined),
  listRouteSteps: vi.fn().mockResolvedValue([]),
  getRoute: vi.fn().mockResolvedValue(null),
}));

async function getHandler() {
  const mod = await import("./+server");
  return mod.POST;
}

function mockEvent(body: { environmentId: string; routeId?: string }) {
  return {
    params: { id: PROJECT_ID },
    request: new Request(`http://localhost/api/projects/${PROJECT_ID}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    locals: { user: { uid: USER_ID } },
  } as unknown as Parameters<Awaited<ReturnType<typeof getHandler>>>[0];
}

describe("control-plane flow (integration)", () => {
  beforeEach(async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getProject).mockResolvedValue(mockProject);
    vi.mocked(db.getOrCreateDefaultWorkspace).mockResolvedValue({
      id: WORKSPACE_ID,
      name: "Default",
      slug: "default",
      ownerUserId: USER_ID,
      createdAt: 1,
      plan: "free",
      planExpiresAt: null,
    });
    vi.mocked(db.listRoutes).mockResolvedValue([mockRoute]);
    vi.mocked(db.getRouteWithSteps).mockResolvedValue({
      route: mockRoute,
      steps: [mockStep],
    });
    vi.mocked(db.insertRequestLog).mockClear();
  });

  it("full path: resolve returns route/provider/model and writes request log", async () => {
    const POST = await getHandler();
    const res = await POST(mockEvent({ environmentId: ENV_ID }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(data.data.routeId).toBe(mockRoute.name);
    expect(data.data.providerType).toBe("openai");
    expect(data.data.modelId).toBe("gpt-4o");
    expect(data.data.explanation).toBeDefined();
    expect(typeof data.data.explanation).toBe("string");
    expect(data.data.explanation).toContain("route=");
    expect(data.data.explanation).toContain("provider=openai");
    expect(data.data.explanation).toContain("model=gpt-4o");

    const { insertRequestLog } = await import("$lib/server/db");
    expect(insertRequestLog).toHaveBeenCalledTimes(1);
    expect(insertRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        environmentId: ENV_ID,
        routeId: ROUTE_ID,
        providerType: "openai",
        finalModelId: "gpt-4o",
        requestStatus: "resolved",
      })
    );
  });

  it("full path: no route returns 404 and writes request log with no_route", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.listRoutes).mockResolvedValue([]);

    const POST = await getHandler();
    const res = await POST(mockEvent({ environmentId: ENV_ID }));
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toBe("no_route");

    expect(db.insertRequestLog).toHaveBeenCalledTimes(1);
    expect(db.insertRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        environmentId: ENV_ID,
        requestStatus: "no_route",
        providerType: "none",
      })
    );
  });

  it("full path: all steps blocked by policy returns 403 and violations", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.evaluatePolicies).mockResolvedValue([
      { policyId: "pol-1", policyName: "Allowlist", type: "model_allowlist", message: "Model gpt-4o is not in allowlist" },
    ]);

    const POST = await getHandler();
    const res = await POST(mockEvent({ environmentId: ENV_ID }));
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toBe("policy_blocked");
    expect(Array.isArray(data.violations)).toBe(true);
    expect(data.violations[0].type).toBe("model_allowlist");

    expect(db.insertRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        requestStatus: "policy_blocked",
        providerType: "none",
      })
    );
  });

  it("full path: resolve response normalizes google to vertex", async () => {
    const db = await import("$lib/server/db");
    const googleStep = { ...mockStep, id: "step-google", providerPreference: "google" };
    vi.mocked(db.getRouteWithSteps).mockResolvedValue({
      route: mockRoute,
      steps: [googleStep],
    });
    vi.mocked(db.evaluatePolicies).mockResolvedValue([]);
    vi.mocked(db.getModelsLifecycleByIds).mockResolvedValue([
      { id: "gpt-4o", canonicalName: "gpt-4o", lifecycleState: null, deprecationDate: null, retirementDate: null, replacementModelId: null, sourceLastVerifiedAt: null },
    ]);

    const POST = await getHandler();
    const res = await POST(mockEvent({ environmentId: ENV_ID }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.providerType).toBe("vertex");
  });
});
