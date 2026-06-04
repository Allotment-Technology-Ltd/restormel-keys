import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetForWorkspace: vi.fn(),
}));

const job = {
  id: "job-1",
  workspaceId: "ws-1",
  projectId: null,
  status: "pending",
  label: null,
  currentStage: null,
  currentAction: null,
  progress: null,
  stages: [],
  sources: [{ text: "x" }],
  stopAfterStage: null,
  pipelineProfileId: null,
  domainPackId: null,
  graphTargetId: null,
  error: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("resolveConnectIngestWorkerMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONNECT_INGEST_WORKER_MODE;
  });

  it("uses full mode when a graph target exists (default)", async () => {
    const { getConnectGraphTargetForWorkspace } = await import("$lib/server/neon");
    vi.mocked(getConnectGraphTargetForWorkspace).mockResolvedValue({
      id: "gt-1",
      workspaceId: "ws-1",
      provider: "surreal",
      endpoint: "https://example.com",
      namespace: "ns",
      database: "db",
      username: "root",
      useDashboardDatabase: false,
      secretCiphertext: null,
      secretIv: null,
      secretAuthTag: null,
      secretEncryptionVersion: 0,
      status: "ok",
      lastTestedAt: null,
      lastError: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const { resolveConnectIngestWorkerMode } = await import("./connect-ingest-worker-mode");
    expect(await resolveConnectIngestWorkerMode(job)).toBe("full");
  });

  it("uses stub mode when no graph target is configured", async () => {
    const { getConnectGraphTargetForWorkspace } = await import("$lib/server/neon");
    vi.mocked(getConnectGraphTargetForWorkspace).mockResolvedValue(null);
    const { resolveConnectIngestWorkerMode } = await import("./connect-ingest-worker-mode");
    expect(await resolveConnectIngestWorkerMode(job)).toBe("stub");
  });

  it("honours CONNECT_INGEST_WORKER_MODE=stub override", async () => {
    process.env.CONNECT_INGEST_WORKER_MODE = "stub";
    const { resolveConnectIngestWorkerMode } = await import("./connect-ingest-worker-mode");
    expect(await resolveConnectIngestWorkerMode(job)).toBe("stub");
  });
});
