import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ConnectGraphTargetRecord } from "$lib/server/neon";

vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetById: vi.fn(),
  getConnectStageRoutingConfig: vi.fn(),
  upsertConnectStageRoutingConfig: vi.fn(),
  // Unused by these tests but imported by the module under test.
  deleteConnectGraphTarget: vi.fn(),
  getConnectGraphTargetForWorkspace: vi.fn(),
  listConnectGraphTargetsForWorkspace: vi.fn(),
  pingDashboardDatabase: vi.fn(),
  updateConnectGraphTargetStatus: vi.fn(),
  upsertConnectGraphTarget: vi.fn(),
}));

function record(over: Partial<ConnectGraphTargetRecord> = {}): ConnectGraphTargetRecord {
  return {
    id: "g1",
    workspaceId: "ws-1",
    label: "Philosophy KG",
    provider: "surreal",
    endpoint: "https://x",
    namespace: "ns",
    database: "db",
    username: null,
    useDashboardDatabase: false,
    defaultDomainPackId: null,
    settings: {},
    secretCiphertext: null,
    secretIv: null,
    secretAuthTag: null,
    secretEncryptionVersion: 0,
    status: "ok",
    lastTestedAt: null,
    lastError: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe("activateGraphTarget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hydrates routing config (pointer + bundle) from the graph", async () => {
    const neon = await import("$lib/server/neon");
    vi.mocked(neon.getConnectStageRoutingConfig).mockResolvedValue({ keep: "me" });
    vi.mocked(neon.getConnectGraphTargetById).mockResolvedValue(
      record({
        defaultDomainPackId: "pack-9",
        settings: { ingest_document_ids: ["d1", "d2"], default_stop_after_stage: "embedding" },
      }),
    );

    const { activateGraphTarget } = await import("./graph-target-service");
    const result = await activateGraphTarget("ws-1", "g1");

    expect(result).toEqual({ ok: true });
    expect(neon.upsertConnectStageRoutingConfig).toHaveBeenCalledWith("ws-1", {
      keep: "me",
      active_graph_target_id: "g1",
      default_domain_pack_id: "pack-9",
      ingest_document_ids: ["d1", "d2"],
      default_stop_after_stage: "embedding",
    });
  });

  it("clears bundle keys when the graph carries no bundle", async () => {
    const neon = await import("$lib/server/neon");
    vi.mocked(neon.getConnectStageRoutingConfig).mockResolvedValue({
      default_domain_pack_id: "old",
      ingest_document_ids: ["stale"],
      default_stop_after_stage: "storing",
    });
    vi.mocked(neon.getConnectGraphTargetById).mockResolvedValue(record());

    const { activateGraphTarget } = await import("./graph-target-service");
    await activateGraphTarget("ws-1", "g1");

    expect(neon.upsertConnectStageRoutingConfig).toHaveBeenCalledWith("ws-1", {
      active_graph_target_id: "g1",
    });
  });

  it("returns not_found when the graph is missing", async () => {
    const neon = await import("$lib/server/neon");
    vi.mocked(neon.getConnectGraphTargetById).mockResolvedValue(null);

    const { activateGraphTarget } = await import("./graph-target-service");
    const result = await activateGraphTarget("ws-1", "nope");

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(neon.upsertConnectStageRoutingConfig).not.toHaveBeenCalled();
  });
});
