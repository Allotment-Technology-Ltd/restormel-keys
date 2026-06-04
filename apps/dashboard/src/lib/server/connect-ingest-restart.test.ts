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
});
