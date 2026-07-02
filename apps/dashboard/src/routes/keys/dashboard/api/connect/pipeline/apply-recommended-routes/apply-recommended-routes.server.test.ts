/**
 * apply-recommended-routes endpoint — ENV-FREE BINDING (B2) server contract.
 *
 * With the client no longer sending environment_id, the endpoint MUST resolve
 * the environment from the project's canonical default and pass a NON-NULL
 * environmentId through to the writer — otherwise routes.environment_id (a FK)
 * could not be populated. Pins that resolution + FK integrity.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const applyRecommendedIngestionRoutes = vi.fn();
const resolveKnowledgeSessionContext = vi.fn();
const isKnowledgeSessionFailure = vi.fn();
const getConnectStageRouting = vi.fn();
const listEnvironments = vi.fn();
const listProviderIntegrations = vi.fn();

vi.mock("$lib/server/connect/apply-recommended-routes", () => ({
  applyRecommendedIngestionRoutes: (...args: unknown[]) => applyRecommendedIngestionRoutes(...args),
}));
vi.mock("$lib/server/connect/session-context", () => ({
  resolveKnowledgeSessionContext: (...args: unknown[]) => resolveKnowledgeSessionContext(...args),
  isKnowledgeSessionFailure: (...args: unknown[]) => isKnowledgeSessionFailure(...args),
}));
vi.mock("$lib/server/connect/stage-routing", () => ({
  getConnectStageRouting: (...args: unknown[]) => getConnectStageRouting(...args),
}));
vi.mock("$lib/server/db", () => ({
  listEnvironments: (...args: unknown[]) => listEnvironments(...args),
  listProviderIntegrations: (...args: unknown[]) => listProviderIntegrations(...args),
}));

import { POST } from "./+server";

function call(body: unknown) {
  const request = { json: async () => body } as unknown as Request;
  const locals = { user: { authType: "session" } } as unknown as App.Locals;
  // @ts-expect-error minimal RequestEvent shape for the handler under test
  return POST({ locals, request });
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveKnowledgeSessionContext.mockResolvedValue({
    workspaceId: "ws-1",
    userId: "u-1",
    projects: [{ id: "proj-1" }],
  });
  isKnowledgeSessionFailure.mockReturnValue(false);
  listProviderIntegrations.mockResolvedValue([{ id: "int-1" }]);
  applyRecommendedIngestionRoutes.mockResolvedValue({
    applied: [{ stage: "extraction" }],
    skipped: [],
    catalogSynced: false,
  });
});

describe("apply-recommended-routes — env-free body", () => {
  it("resolves the environment from the project default and passes a non-null FK", async () => {
    // no environment_id in the body, no routing default → must fall back to listEnvironments
    getConnectStageRouting.mockResolvedValue({ project_id: "proj-1", environment_id: null });
    listEnvironments.mockResolvedValue([{ id: "env-default" }]);

    const res = await call({ project_id: "proj-1" });
    expect(res.status).toBe(200);

    expect(listEnvironments).toHaveBeenCalledWith("proj-1", "u-1");
    const passed = applyRecommendedIngestionRoutes.mock.calls[0][0];
    expect(passed.projectId).toBe("proj-1");
    // FK integrity: a real environment id reached the writer.
    expect(passed.environmentId).toBe("env-default");
  });

  it("prefers the persisted routing environment when present (still no client env needed)", async () => {
    getConnectStageRouting.mockResolvedValue({ project_id: "proj-1", environment_id: "env-routing" });

    const res = await call({ project_id: "proj-1" });
    expect(res.status).toBe(200);

    // routing default short-circuits the listEnvironments fallback.
    expect(listEnvironments).not.toHaveBeenCalled();
    expect(applyRecommendedIngestionRoutes.mock.calls[0][0].environmentId).toBe("env-routing");
  });

  it("400s when the project has no environment at all (no silent null FK)", async () => {
    getConnectStageRouting.mockResolvedValue({ project_id: "proj-1", environment_id: null });
    listEnvironments.mockResolvedValue([]);

    const res = await call({ project_id: "proj-1" });
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toBe("no_environment");
    expect(applyRecommendedIngestionRoutes).not.toHaveBeenCalled();
  });
});
