/**
 * Phase 3 Stage 0 — auto-provision gate: provisions only when a provider key
 * exists, a project resolves, and published chat+embedding routes are missing.
 * The underlying engine + data layer are mocked (the engine is tested separately).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const listProviderIntegrations = vi.fn();
const resolveDefaultKnowledgeProject = vi.fn();
const listConnectStageRouteRows = vi.fn();
const applyRecommendedIngestionRoutes = vi.fn();

vi.mock("$lib/server/db", () => ({
  listProviderIntegrations: (...a: unknown[]) => listProviderIntegrations(...a),
}));
vi.mock("$lib/server/connect/stage-routing", () => ({
  resolveDefaultKnowledgeProject: (...a: unknown[]) => resolveDefaultKnowledgeProject(...a),
  listConnectStageRouteRows: (...a: unknown[]) => listConnectStageRouteRows(...a),
}));
vi.mock("$lib/server/connect/apply-recommended-routes", () => ({
  applyRecommendedIngestionRoutes: (...a: unknown[]) => applyRecommendedIngestionRoutes(...a),
}));

import { autoProvisionDefaultRoutes } from "./auto-provision-default-routes";

function publishedRow(key: string) {
  return { key, route: { id: `r-${key}`, name: key, status: "active", isPublished: true, enabled: true } };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveDefaultKnowledgeProject.mockResolvedValue({ projectId: "p-1", environmentId: "e-1" });
  listConnectStageRouteRows.mockResolvedValue([]);
  applyRecommendedIngestionRoutes.mockResolvedValue({
    applied: [{ stage: "extraction" }, { stage: "embedding" }],
    skipped: [],
    catalogSynced: true,
  });
});

describe("autoProvisionDefaultRoutes", () => {
  it("no-ops when the workspace has no connected provider key", async () => {
    listProviderIntegrations.mockResolvedValue([]);
    const out = await autoProvisionDefaultRoutes({ workspaceId: "ws-1", userId: "u-1" });
    expect(out).toEqual({ provisioned: false, reason: "no_provider_key" });
    expect(applyRecommendedIngestionRoutes).not.toHaveBeenCalled();
  });

  it("no-ops when no project resolves", async () => {
    listProviderIntegrations.mockResolvedValue([{ providerType: "anthropic", status: "active" }]);
    resolveDefaultKnowledgeProject.mockResolvedValue(null);
    const out = await autoProvisionDefaultRoutes({ workspaceId: "ws-1", userId: "u-1" });
    expect(out).toEqual({ provisioned: false, reason: "no_project" });
  });

  it("no-ops when published chat + embedding routes already exist", async () => {
    listProviderIntegrations.mockResolvedValue([{ providerType: "anthropic", status: "active" }]);
    listConnectStageRouteRows.mockResolvedValue([publishedRow("extraction"), publishedRow("embedding")]);
    const out = await autoProvisionDefaultRoutes({ workspaceId: "ws-1", userId: "u-1" });
    expect(out).toEqual({ provisioned: false, reason: "already_has_routes" });
    expect(applyRecommendedIngestionRoutes).not.toHaveBeenCalled();
  });

  it("provisions via the engine when a key exists but routes are missing", async () => {
    listProviderIntegrations.mockResolvedValue([{ providerType: "openai", status: "active" }]);
    listConnectStageRouteRows.mockResolvedValue([]); // nothing published yet
    const out = await autoProvisionDefaultRoutes({ workspaceId: "ws-1", userId: "u-1" });
    expect(out).toEqual({
      provisioned: true,
      projectId: "p-1",
      environmentId: "e-1",
      stagesApplied: 2,
      stagesSkipped: 0,
    });
    expect(applyRecommendedIngestionRoutes).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1", projectId: "p-1", environmentId: "e-1" }),
    );
  });

  it("treats a chat route WITHOUT an embedding route as incomplete (provisions)", async () => {
    listProviderIntegrations.mockResolvedValue([{ providerType: "anthropic", status: "active" }]);
    listConnectStageRouteRows.mockResolvedValue([publishedRow("extraction")]); // no embedding
    const out = await autoProvisionDefaultRoutes({ workspaceId: "ws-1", userId: "u-1" });
    expect(out.provisioned).toBe(true);
  });
});
