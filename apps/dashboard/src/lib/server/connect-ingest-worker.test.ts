import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("$lib/server/connect-ingest-jobs", () => ({
  claimNextPendingConnectIngestJob: vi.fn(),
  heartbeatConnectIngestJobLease: vi.fn(async () => true),
  reclaimStaleRunningConnectIngestJobs: vi.fn(async () => []),
  updateConnectIngestJobById: vi.fn(),
  appendConnectIngestJobLog: vi.fn(async () => 1),
  getConnectIngestJobForWorkspace: vi.fn(async () => null),
  CONNECT_INGEST_DEFAULT_LEASE_MS: 300_000,
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

describe("durable runs (Stage 1.6) — lease, heartbeat, reclaim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONNECT_INGEST_WORKER_MODE = "stub";
    process.env.CONNECT_INGEST_STUB_PAUSE_MS = "0";
    delete process.env.CONNECT_INGEST_LEASE_MS;
    delete process.env.CONNECT_INGEST_WORKER_HEARTBEAT_MS;
  });

  it("claims with a worker id + lease so the row is reclaimable on stall", async () => {
    const { claimNextPendingConnectIngestJob } = await import("$lib/server/connect-ingest-jobs");
    vi.mocked(claimNextPendingConnectIngestJob).mockResolvedValue(null);
    const { runConnectIngestWorkerOnce } = await import("$lib/server/connect-ingest-worker");
    await runConnectIngestWorkerOnce();
    expect(claimNextPendingConnectIngestJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workerId: expect.stringContaining("ingest-"),
        leaseMs: expect.any(Number),
      }),
    );
  });

  it("worker-loop heartbeat extends the lease on an interval until stopped", async () => {
    vi.useFakeTimers();
    try {
      const { heartbeatConnectIngestJobLease } = await import("$lib/server/connect-ingest-jobs");
      const { startConnectIngestWorkerHeartbeat } = await import(
        "$lib/server/connect-ingest-worker"
      );
      const stop = startConnectIngestWorkerHeartbeat(
        { id: "job-1", workerId: "w-1" },
        { intervalMs: 1_000, leaseMs: 60_000 },
      );
      await vi.advanceTimersByTimeAsync(3_500);
      expect(heartbeatConnectIngestJobLease).toHaveBeenCalledTimes(3);
      expect(heartbeatConnectIngestJobLease).toHaveBeenCalledWith({
        id: "job-1",
        workerId: "w-1",
        leaseMs: 60_000,
      });
      stop();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(heartbeatConnectIngestJobLease).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drain honors lease expiry: reclaims stale running jobs BEFORE claiming", async () => {
    const { claimNextPendingConnectIngestJob, reclaimStaleRunningConnectIngestJobs } =
      await import("$lib/server/connect-ingest-jobs");
    vi.mocked(claimNextPendingConnectIngestJob).mockResolvedValue(null);
    const { runConnectIngestWorkerLoop } = await import("$lib/server/connect-ingest-worker");
    await runConnectIngestWorkerLoop(2);
    expect(reclaimStaleRunningConnectIngestJobs).toHaveBeenCalledTimes(1);
    const reclaimOrder = vi.mocked(reclaimStaleRunningConnectIngestJobs).mock
      .invocationCallOrder[0]!;
    const claimOrder = vi.mocked(claimNextPendingConnectIngestJob).mock.invocationCallOrder[0]!;
    expect(reclaimOrder).toBeLessThan(claimOrder);
  });

  it("a reclaimed run gets an operator-visible 'reclaimed after stall' console event", async () => {
    const { reclaimStaleRunningConnectIngestJobs, appendConnectIngestJobLog } = await import(
      "$lib/server/connect-ingest-jobs"
    );
    vi.mocked(reclaimStaleRunningConnectIngestJobs).mockResolvedValue([
      {
        id: "job-9",
        workspaceId: "ws-1",
        projectId: null,
        status: "failed",
        label: null,
        currentStage: null,
        currentAction: "Reclaimed after stall",
        progress: null,
        stages: [],
        sources: [],
        stopAfterStage: null,
        pipelineProfileId: null,
        domainPackId: null,
        graphTargetId: null,
        error: "worker_lost: reclaimed after stall — no worker heartbeat before lease expiry",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    const { reclaimStaleConnectIngestRuns } = await import("$lib/server/connect-ingest-worker");
    const n = await reclaimStaleConnectIngestRuns();
    expect(n).toBe(1);
    expect(appendConnectIngestJobLog).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-9",
        line: expect.stringContaining("reclaimed after stall"),
      }),
    );
  });
});

describe("inline drain gate (Coolify Stage 2.2 — CONNECT_INGEST_INLINE_DRAIN)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONNECT_INGEST_WORKER_MODE = "stub";
    process.env.CONNECT_INGEST_STUB_PAUSE_MS = "0";
    delete process.env.CONNECT_INGEST_INLINE_DRAIN;
  });

  afterEach(() => {
    delete process.env.CONNECT_INGEST_INLINE_DRAIN;
  });

  it("defaults ON (unset/empty/1) and parses common off-spellings", async () => {
    const { connectIngestInlineDrainEnabled } = await import(
      "$lib/server/connect-ingest-worker"
    );
    expect(connectIngestInlineDrainEnabled()).toBe(true);
    process.env.CONNECT_INGEST_INLINE_DRAIN = "";
    expect(connectIngestInlineDrainEnabled()).toBe(true);
    process.env.CONNECT_INGEST_INLINE_DRAIN = "1";
    expect(connectIngestInlineDrainEnabled()).toBe(true);
    for (const off of ["0", "false", "off", "no", " FALSE "]) {
      process.env.CONNECT_INGEST_INLINE_DRAIN = off;
      expect(connectIngestInlineDrainEnabled()).toBe(false);
    }
  });

  it("schedules the post-POST drain by default (current Vercel behavior)", async () => {
    const { claimNextPendingConnectIngestJob, reclaimStaleRunningConnectIngestJobs } =
      await import("$lib/server/connect-ingest-jobs");
    vi.mocked(claimNextPendingConnectIngestJob).mockResolvedValue(null);
    const { scheduleConnectIngestWorkerDrain } = await import(
      "$lib/server/connect-ingest-worker"
    );
    scheduleConnectIngestWorkerDrain();
    await vi.waitFor(() => {
      expect(reclaimStaleRunningConnectIngestJobs).toHaveBeenCalled();
      expect(claimNextPendingConnectIngestJob).toHaveBeenCalled();
    });
  });

  it("no-ops cleanly when gated off — the worker daemon owns all draining", async () => {
    process.env.CONNECT_INGEST_INLINE_DRAIN = "0";
    const { claimNextPendingConnectIngestJob, reclaimStaleRunningConnectIngestJobs } =
      await import("$lib/server/connect-ingest-jobs");
    vi.mocked(claimNextPendingConnectIngestJob).mockResolvedValue(null);
    const { scheduleConnectIngestWorkerDrain } = await import(
      "$lib/server/connect-ingest-worker"
    );
    expect(() => scheduleConnectIngestWorkerDrain()).not.toThrow();
    // Flush microtasks + a macrotask: nothing may touch the queue.
    await new Promise((r) => setTimeout(r, 20));
    expect(reclaimStaleRunningConnectIngestJobs).not.toHaveBeenCalled();
    expect(claimNextPendingConnectIngestJob).not.toHaveBeenCalled();
  });
});

describe("dual-run safety — concurrent drainers never double-process (lease claim)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONNECT_INGEST_WORKER_MODE = "stub";
    process.env.CONNECT_INGEST_STUB_PAUSE_MS = "0";
  });

  it("two simultaneous drains (worker daemon + Vercel cron / inline) process one job once", async () => {
    const { claimNextPendingConnectIngestJob, updateConnectIngestJobById } = await import(
      "$lib/server/connect-ingest-jobs"
    );
    // Atomic-claim semantics: the DB hands the pending row to exactly one
    // claimer (UPDATE … RETURNING); everyone else sees an empty queue.
    const queue = [
      {
        id: "job-dual",
        workspaceId: "ws-1",
        projectId: null,
        status: "pending" as const,
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
      },
    ];
    vi.mocked(claimNextPendingConnectIngestJob).mockImplementation(
      async () => queue.shift() ?? null,
    );
    const { drainConnectIngestQueue } = await import("$lib/server/connect-ingest-worker");
    const [a, b] = await Promise.all([
      drainConnectIngestQueue({ maxJobs: 5 }),
      drainConnectIngestQueue({ maxJobs: 5 }),
    ]);
    expect(a.processed + b.processed).toBe(1);
    const completions = vi
      .mocked(updateConnectIngestJobById)
      .mock.calls.filter(([args]) => args?.status === "completed");
    expect(completions).toHaveLength(1);
  });
});

describe("vercelWaitUntil", () => {
  const CTX_SYMBOL = Symbol.for("@vercel/request-context");

  afterEach(() => {
    delete (globalThis as Record<symbol, unknown>)[CTX_SYMBOL];
  });

  it("registers the drain with the Vercel request context when present", async () => {
    const { vercelWaitUntil } = await import("$lib/server/connect-ingest-worker");
    const waitUntil = vi.fn();
    (globalThis as Record<symbol, unknown>)[CTX_SYMBOL] = { get: () => ({ waitUntil }) };
    const p = Promise.resolve();
    expect(vercelWaitUntil(p)).toBe(true);
    expect(waitUntil).toHaveBeenCalledWith(p);
  });

  it("is a safe no-op outside Vercel", async () => {
    const { vercelWaitUntil } = await import("$lib/server/connect-ingest-worker");
    expect(vercelWaitUntil(Promise.resolve())).toBe(false);
  });
});
