import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("$lib/server/connect/session-context", () => ({
  resolveKnowledgeSessionContext: vi.fn(),
  isKnowledgeSessionFailure: vi.fn(() => false),
}));

vi.mock("$lib/server/connect-ingest-jobs", () => ({
  getConnectIngestJobForWorkspace: vi.fn(),
  insertConnectIngestJob: vi.fn(),
  connectIngestJobRecordToApi: vi.fn((row) => row),
  appendConnectIngestJobLog: vi.fn(),
  requeueReclaimedConnectIngestJob: vi.fn(),
  CONNECT_INGEST_WORKER_LOST_ERROR: "worker_lost",
}));

vi.mock("$lib/server/connect-ingest-worker", () => ({
  scheduleConnectIngestWorkerDrain: vi.fn(),
}));

describe("ingest job restart API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects restart when job is still running", async () => {
    const { resolveKnowledgeSessionContext } = await import("$lib/server/connect/session-context");
    const { getConnectIngestJobForWorkspace } = await import("$lib/server/connect-ingest-jobs");
    vi.mocked(resolveKnowledgeSessionContext).mockResolvedValue({
      workspaceId: "ws-1",
      projects: [],
    } as never);
    vi.mocked(getConnectIngestJobForWorkspace).mockResolvedValue({
      id: "job-1",
      workspaceId: "ws-1",
      projectId: null,
      status: "running",
      label: "Test",
      currentStage: "extracting",
      currentAction: null,
      progress: null,
      stages: [],
      sources: [{ text: "hello" }],
      stopAfterStage: null,
      pipelineProfileId: null,
      domainPackId: null,
      graphTargetId: null,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const { POST } = await import(
      "../../routes/keys/dashboard/api/connect/ingest/jobs/[jobId]/restart/+server"
    );
    const res = await POST({
      locals: {},
      params: { jobId: "job-1" },
    } as never);

    expect(res.status).toBe(409);
  });

  it("creates a new queued job from a failed run", async () => {
    const { resolveKnowledgeSessionContext } = await import("$lib/server/connect/session-context");
    const {
      getConnectIngestJobForWorkspace,
      insertConnectIngestJob,
    } = await import("$lib/server/connect-ingest-jobs");
    vi.mocked(resolveKnowledgeSessionContext).mockResolvedValue({
      workspaceId: "ws-1",
      projects: [],
    } as never);
    vi.mocked(getConnectIngestJobForWorkspace)
      .mockResolvedValueOnce({
        id: "job-old",
        workspaceId: "ws-1",
        projectId: null,
        status: "failed",
        label: "First run",
        currentStage: null,
        currentAction: null,
        progress: null,
        stages: [],
        sources: [{ text: "hello" }],
        stopAfterStage: null,
        pipelineProfileId: null,
        domainPackId: "pack-1",
        graphTargetId: "gt-1",
        error: "boom",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .mockResolvedValueOnce({
        id: "job-new",
        workspaceId: "ws-1",
        projectId: null,
        status: "pending",
        label: "First run (retry)",
        currentStage: null,
        currentAction: null,
        progress: null,
        stages: [],
        sources: [{ text: "hello" }],
        stopAfterStage: null,
        pipelineProfileId: null,
        domainPackId: "pack-1",
        graphTargetId: "gt-1",
        error: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

    const { POST } = await import(
      "../../routes/keys/dashboard/api/connect/ingest/jobs/[jobId]/restart/+server"
    );
    const res = await POST({
      locals: {},
      params: { jobId: "job-old" },
    } as never);

    expect(res.status).toBe(201);
    expect(insertConnectIngestJob).toHaveBeenCalled();
    const body = await res.json();
    expect(body.restarted_from).toBe("job-old");
    expect(body.job.id).toBe("job-new");
  });

  it("re-queues a reclaimed (worker_lost) run IN PLACE so the checkpoint is reused", async () => {
    const { resolveKnowledgeSessionContext } = await import("$lib/server/connect/session-context");
    const {
      getConnectIngestJobForWorkspace,
      insertConnectIngestJob,
      requeueReclaimedConnectIngestJob,
      appendConnectIngestJobLog,
    } = await import("$lib/server/connect-ingest-jobs");
    vi.mocked(resolveKnowledgeSessionContext).mockResolvedValue({
      workspaceId: "ws-1",
      projects: [],
    } as never);
    const base = {
      id: "job-old",
      workspaceId: "ws-1",
      projectId: null,
      label: "Stalled run",
      currentStage: null,
      currentAction: null,
      stages: [],
      sources: [{ text: "hello" }],
      stopAfterStage: null,
      pipelineProfileId: null,
      domainPackId: null,
      graphTargetId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    vi.mocked(getConnectIngestJobForWorkspace).mockResolvedValue({
      ...base,
      status: "failed",
      progress: {
        percent: 40,
        processed: 2,
        total: 7,
        resume: { sources_done: 1, last_stage_completed: "remediating" },
      },
      error: "worker_lost: reclaimed after stall — no worker heartbeat before lease expiry",
    } as never);
    vi.mocked(requeueReclaimedConnectIngestJob).mockResolvedValue({
      ...base,
      status: "pending",
      progress: {
        percent: 40,
        processed: 2,
        total: 7,
        resume: { sources_done: 1, last_stage_completed: "remediating" },
      },
      error: null,
    } as never);

    const { POST } = await import(
      "../../routes/keys/dashboard/api/connect/ingest/jobs/[jobId]/restart/+server"
    );
    const res = await POST({
      locals: {},
      params: { jobId: "job-old" },
    } as never);

    expect(res.status).toBe(201);
    // In-place requeue: SAME job id, no new job row — the checkpoint travels with it.
    expect(requeueReclaimedConnectIngestJob).toHaveBeenCalledWith({
      id: "job-old",
      workspaceId: "ws-1",
    });
    expect(insertConnectIngestJob).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.job.id).toBe("job-old");
    expect(appendConnectIngestJobLog).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-old",
        line: expect.stringContaining("resuming from checkpoint"),
      }),
    );
  });

  it("409s when the requeue raced and the job is no longer restartable", async () => {
    const { resolveKnowledgeSessionContext } = await import("$lib/server/connect/session-context");
    const { getConnectIngestJobForWorkspace, requeueReclaimedConnectIngestJob } = await import(
      "$lib/server/connect-ingest-jobs"
    );
    vi.mocked(resolveKnowledgeSessionContext).mockResolvedValue({
      workspaceId: "ws-1",
      projects: [],
    } as never);
    vi.mocked(getConnectIngestJobForWorkspace)
      .mockResolvedValueOnce({
        id: "job-old",
        workspaceId: "ws-1",
        projectId: null,
        status: "failed",
        label: null,
        currentStage: null,
        currentAction: null,
        progress: null,
        stages: [],
        sources: [{ text: "hello" }],
        stopAfterStage: null,
        pipelineProfileId: null,
        domainPackId: null,
        graphTargetId: null,
        error: "worker_lost: reclaimed after stall",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as never)
      // Re-fetch after the failed requeue: the job completed in the meantime.
      .mockResolvedValueOnce({ id: "job-old", status: "completed" } as never);
    vi.mocked(requeueReclaimedConnectIngestJob).mockResolvedValue(null);

    const { POST } = await import(
      "../../routes/keys/dashboard/api/connect/ingest/jobs/[jobId]/restart/+server"
    );
    const res = await POST({
      locals: {},
      params: { jobId: "job-old" },
    } as never);
    expect(res.status).toBe(409);
  });
});
