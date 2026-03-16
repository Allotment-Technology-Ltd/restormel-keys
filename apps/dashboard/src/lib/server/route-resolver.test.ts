/**
 * Route resolver: project + environment → route → step → provider/model.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveRouteForExecution } from "./route-resolver";

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
};

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn(),
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue({ id: "ws1" }),
  listRoutes: vi.fn(),
  getRouteWithSteps: vi.fn(),
}));

describe("resolveRouteForExecution", () => {
  beforeEach(async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getProject).mockResolvedValue(mockProject);
    vi.mocked(db.listRoutes).mockResolvedValue([mockRoute]);
    vi.mocked(db.getRouteWithSteps).mockResolvedValue({
      route: mockRoute,
      steps: [mockStep],
    });
  });

  it("returns null when project not found", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getProject).mockResolvedValue(null);
    const result = await resolveRouteForExecution("p1", "env-1", "u1");
    expect(result).toBeNull();
  });

  it("returns null when no active routes for environment", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.listRoutes).mockResolvedValue([
      { ...mockRoute, status: "paused" },
    ]);
    const result = await resolveRouteForExecution("p1", "env-1", "u1");
    expect(result).toBeNull();
  });

  it("returns resolved result with first enabled step provider and model", async () => {
    const result = await resolveRouteForExecution("p1", "env-1", "u1");
    expect(result).not.toBeNull();
    expect(result!.workspaceId).toBe("ws1");
    expect(result!.projectId).toBe("p1");
    expect(result!.environmentId).toBe("env-1");
    expect(result!.route.id).toBe("route-1");
    expect(result!.selectedStep).not.toBeNull();
    expect(result!.providerType).toBe("openai");
    expect(result!.modelId).toBe("gpt-4o");
    expect(result!.explanation).toContain("route=route-1");
    expect(result!.explanation).toContain("provider=openai");
  });

  it("uses route defaultModelId when step has no modelId", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getRouteWithSteps).mockResolvedValue({
      route: mockRoute,
      steps: [{ ...mockStep, modelId: null }],
    });
    const result = await resolveRouteForExecution("p1", "env-1", "u1");
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe("gpt-4o");
  });

  it("returns selectedStep null and model from route when no enabled steps", async () => {
    const db = await import("$lib/server/db");
    vi.mocked(db.getRouteWithSteps).mockResolvedValue({
      route: mockRoute,
      steps: [{ ...mockStep, enabled: false }],
    });
    const result = await resolveRouteForExecution("p1", "env-1", "u1");
    expect(result).not.toBeNull();
    expect(result!.selectedStep).toBeNull();
    expect(result!.providerType).toBeNull();
    expect(result!.modelId).toBe("gpt-4o");
  });
});
