/**
 * Worker daemon loop (Coolify migration Stage 2.2): interval/jitter resolution,
 * sweep iteration, error resilience, and graceful SIGTERM-style shutdown — the
 * in-flight drain (claim + heartbeat) must finish before the daemon resolves.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// The daemon must REUSE the PR #229 drain — never reimplement claiming. Mock the
// worker module so this test exercises only the loop choreography.
vi.mock("$lib/server/connect-ingest-worker", () => ({
  drainConnectIngestQueue: vi.fn(async () => ({ reclaimed: 0, processed: 0 })),
}));

import {
  CONNECT_INGEST_DAEMON_DEFAULT_INTERVAL_MS,
  CONNECT_INGEST_DAEMON_MIN_INTERVAL_MS,
  CONNECT_INGEST_DAEMON_MAX_INTERVAL_MS,
  connectIngestDaemonIntervalMs,
  connectIngestDaemonMaxJobs,
  jitterConnectIngestIntervalMs,
  runConnectIngestWorkerDaemon,
} from "$lib/server/connect-ingest-daemon";
import { drainConnectIngestQueue } from "$lib/server/connect-ingest-worker";

const silent = () => {};

describe("connectIngestDaemonIntervalMs", () => {
  it("defaults to 30s when unset or invalid", () => {
    expect(connectIngestDaemonIntervalMs({})).toBe(CONNECT_INGEST_DAEMON_DEFAULT_INTERVAL_MS);
    expect(connectIngestDaemonIntervalMs({ CONNECT_INGEST_WORKER_INTERVAL_MS: "nope" })).toBe(
      CONNECT_INGEST_DAEMON_DEFAULT_INTERVAL_MS,
    );
    expect(connectIngestDaemonIntervalMs({ CONNECT_INGEST_WORKER_INTERVAL_MS: "-5" })).toBe(
      CONNECT_INGEST_DAEMON_DEFAULT_INTERVAL_MS,
    );
  });

  it("honors the env override and clamps to sane bounds", () => {
    expect(connectIngestDaemonIntervalMs({ CONNECT_INGEST_WORKER_INTERVAL_MS: "60000" })).toBe(
      60_000,
    );
    expect(connectIngestDaemonIntervalMs({ CONNECT_INGEST_WORKER_INTERVAL_MS: "10" })).toBe(
      CONNECT_INGEST_DAEMON_MIN_INTERVAL_MS,
    );
    expect(
      connectIngestDaemonIntervalMs({ CONNECT_INGEST_WORKER_INTERVAL_MS: "999999999" }),
    ).toBe(CONNECT_INGEST_DAEMON_MAX_INTERVAL_MS);
  });
});

describe("connectIngestDaemonMaxJobs", () => {
  it("defaults to 10 and honors the env override", () => {
    expect(connectIngestDaemonMaxJobs({})).toBe(10);
    expect(connectIngestDaemonMaxJobs({ KNOWLEDGE_INGEST_WORKER_MAX_JOBS: "3" })).toBe(3);
    expect(connectIngestDaemonMaxJobs({ KNOWLEDGE_INGEST_WORKER_MAX_JOBS: "0" })).toBe(10);
  });
});

describe("jitterConnectIngestIntervalMs", () => {
  it("stays within ±10% of the base interval", () => {
    expect(jitterConnectIngestIntervalMs(30_000, () => 0)).toBe(27_000); // -10%
    expect(jitterConnectIngestIntervalMs(30_000, () => 0.5)).toBe(30_000); // ±0
    expect(jitterConnectIngestIntervalMs(30_000, () => 1)).toBe(33_000); // +10%
    for (let i = 0; i < 50; i++) {
      const jittered = jitterConnectIngestIntervalMs(30_000);
      expect(jittered).toBeGreaterThanOrEqual(27_000);
      expect(jittered).toBeLessThanOrEqual(33_000);
    }
  });
});

describe("runConnectIngestWorkerDaemon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loops drain sweeps with the configured maxJobs and tallies results", async () => {
    const drain = vi
      .fn()
      .mockResolvedValueOnce({ reclaimed: 1, processed: 2 })
      .mockResolvedValue({ reclaimed: 0, processed: 0 });
    const result = await runConnectIngestWorkerDaemon({
      drain,
      intervalMs: 1,
      maxJobsPerSweep: 5,
      maxSweeps: 3,
      log: silent,
    });
    expect(drain).toHaveBeenCalledTimes(3);
    expect(drain).toHaveBeenCalledWith({ maxJobs: 5 });
    expect(result).toEqual({ sweeps: 3, processed: 2, reclaimed: 1, errors: 0 });
  });

  it("defaults to the real drainConnectIngestQueue when no drain is injected", async () => {
    await runConnectIngestWorkerDaemon({ intervalMs: 1, maxSweeps: 1, log: silent });
    expect(vi.mocked(drainConnectIngestQueue)).toHaveBeenCalledTimes(1);
  });

  it("survives a drain error and keeps sweeping (logged, counted)", async () => {
    const drain = vi
      .fn()
      .mockRejectedValueOnce(new Error("neon hiccup"))
      .mockResolvedValue({ reclaimed: 0, processed: 1 });
    const log = vi.fn();
    const result = await runConnectIngestWorkerDaemon({
      drain,
      intervalMs: 1,
      maxSweeps: 2,
      log,
    });
    expect(result.errors).toBe(1);
    expect(result.processed).toBe(1);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "drain_error", error: "neon hiccup" }),
    );
  });

  it("graceful shutdown: an abort mid-sweep finishes the in-flight drain first", async () => {
    let finishDrain!: () => void;
    const drain = vi.fn(
      () =>
        new Promise<{ reclaimed: number; processed: number }>((resolve) => {
          finishDrain = () => resolve({ reclaimed: 0, processed: 1 });
        }),
    );
    const controller = new AbortController();
    let settled = false;
    const done = runConnectIngestWorkerDaemon({
      drain,
      intervalMs: 1,
      signal: controller.signal,
      log: silent,
    }).then((r) => {
      settled = true;
      return r;
    });

    // Wait until the sweep is in flight, then request shutdown (SIGTERM path).
    await vi.waitFor(() => expect(drain).toHaveBeenCalledTimes(1));
    controller.abort();

    // The daemon must NOT resolve while the claim is still in flight — the
    // job's heartbeat is stopped by the drain's own `finally`, so cutting the
    // loop early would abandon the lease mid-beat.
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).toBe(false);

    finishDrain();
    const result = await done;
    expect(result).toEqual({ sweeps: 1, processed: 1, reclaimed: 0, errors: 0 });
    expect(drain).toHaveBeenCalledTimes(1); // no new sweep after shutdown
  });

  it("an abort during the sleep window exits promptly without another sweep", async () => {
    const drain = vi.fn().mockResolvedValue({ reclaimed: 0, processed: 0 });
    const controller = new AbortController();
    const done = runConnectIngestWorkerDaemon({
      drain,
      intervalMs: 60_000, // would block for a minute if the sleep ignored the signal
      signal: controller.signal,
      log: silent,
    });
    await vi.waitFor(() => expect(drain).toHaveBeenCalledTimes(1));
    controller.abort();
    const result = await done;
    expect(result.sweeps).toBe(1);
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it("a pre-aborted signal never claims at all", async () => {
    const drain = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const result = await runConnectIngestWorkerDaemon({
      drain,
      intervalMs: 1,
      signal: controller.signal,
      log: silent,
    });
    expect(drain).not.toHaveBeenCalled();
    expect(result.sweeps).toBe(0);
  });

  it("emits structured start/stop log entries", async () => {
    const log = vi.fn();
    await runConnectIngestWorkerDaemon({
      drain: vi.fn().mockResolvedValue({ reclaimed: 0, processed: 0 }),
      intervalMs: 1,
      maxSweeps: 1,
      log,
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "daemon_start", interval_ms: 1 }),
    );
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: "daemon_stop", sweeps: 1 }));
  });
});
