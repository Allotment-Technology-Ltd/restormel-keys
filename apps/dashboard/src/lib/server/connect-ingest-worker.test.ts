import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/server/connect-ingest-jobs", () => ({
  claimNextPendingConnectIngestJob: vi.fn(),
  updateConnectIngestJobById: vi.fn(),
  appendConnectIngestJobLog: vi.fn(),
}));

describe("connect-ingest-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONNECT_INGEST_WORKER_MODE;
    process.env.CONNECT_INGEST_WORKER_MODE = "stub";
    process.env.CONNECT_INGEST_STUB_PAUSE_MS = "0";
  });

  it("returns false when queue is empty", async () => {
    const { claimNextPendingConnectIngestJob } = await import(
      "$lib/server/connect-ingest-jobs"
    );
    vi.mocked(claimNextPendingConnectIngestJob).mockResolvedValue(null);
    const { runConnectIngestWorkerOnce } = await import(
      "$lib/server/connect-ingest-worker"
    );
    expect(await runConnectIngestWorkerOnce()).toBe(false);
  });

  it("completes stub job when sources are valid", async () => {
    const { claimNextPendingConnectIngestJob, updateConnectIngestJobById } = await import(
      "$lib/server/connect-ingest-jobs"
    );
    vi.mocked(claimNextPendingConnectIngestJob).mockResolvedValue({
      id: "job-1",
      workspaceId: "ws-1",
      projectId: "p-1",
      status: "pending",
      label: null,
      currentStage: null,
      currentAction: null,
      progress: null,
      stages: [{ stage: "extracting", status: "pending" }],
      sources: [{ text: "Sample corpus." }],
      stopAfterStage: null,
      pipelineProfileId: null,
      domainPackId: null,
      graphTargetId: null,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const { runConnectIngestWorkerOnce } = await import(
      "$lib/server/connect-ingest-worker"
    );
    expect(await runConnectIngestWorkerOnce()).toBe(true);
    expect(updateConnectIngestJobById).toHaveBeenCalled();
    const last = vi.mocked(updateConnectIngestJobById).mock.calls.at(-1)?.[0];
    expect(last?.status).toBe("completed");
  });
});
