import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectIngestJobRecord } from "$lib/server/connect-ingest-jobs";
import { ConnectIngestProgressReporter } from "./connect-ingest-progress";

vi.mock("$lib/server/connect-ingest-jobs", () => ({
  appendConnectIngestJobLog: vi.fn(async () => {}),
  updateConnectIngestJobById: vi.fn(async () => {}),
}));

function mockJob(): ConnectIngestJobRecord {
  return {
    id: "job-1",
    workspaceId: "ws-1",
    projectId: null,
    status: "running",
    label: "Graph repair",
    currentStage: null,
    currentAction: null,
    progress: null,
    stages: [],
    sources: [],
    stopAfterStage: null,
    pipelineProfileId: null,
    domainPackId: null,
    graphTargetId: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("ConnectIngestProgressReporter graph_repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses unit-based percent when graph_repair is active", async () => {
    const reporter = new ConnectIngestProgressReporter(mockJob());
    reporter.initGraphRepair({
      mode: "validate_and_remediate",
      units_total: 538,
      sources_total: 4,
      quarantine_before: 538,
    });
    await reporter.setGraphRepair({ phase: "validating", units_processed: 125 });

    const { updateConnectIngestJobById } = await import("$lib/server/connect-ingest-jobs");
    const lastCall = vi.mocked(updateConnectIngestJobById).mock.calls.at(-1)?.[0];
    expect(lastCall?.progress?.percent).toBe(23);
    expect(lastCall?.progress?.processed).toBe(125);
    expect(lastCall?.progress?.total).toBe(538);
    expect(lastCall?.progress?.graph_repair?.units_processed).toBe(125);
    expect(lastCall?.progress?.graph_repair?.quarantine_before).toBe(538);
  });

  it("persists graph_repair when log() is called during repair", async () => {
    const reporter = new ConnectIngestProgressReporter(mockJob());
    reporter.initGraphRepair({
      mode: "validate_and_remediate",
      units_total: 100,
      sources_total: 2,
    });
    await reporter.setGraphRepair({ phase: "validating", units_processed: 40 });
    vi.mocked(
      (await import("$lib/server/connect-ingest-jobs")).updateConnectIngestJobById,
    ).mockClear();

    await reporter.log("VALIDATE", "Still working on batch 2/10");

    const { updateConnectIngestJobById } = await import("$lib/server/connect-ingest-jobs");
    expect(updateConnectIngestJobById).toHaveBeenCalled();
    const lastCall = vi.mocked(updateConnectIngestJobById).mock.calls.at(-1)?.[0];
    expect(lastCall?.progress?.graph_repair?.units_processed).toBe(40);
    expect(lastCall?.progress?.graph_repair?.last_activity_at).toBeTruthy();
  });

  it("tick with graphRepairPatch updates units before persist", async () => {
    const reporter = new ConnectIngestProgressReporter(mockJob());
    reporter.initGraphRepair({
      mode: "validate_and_remediate",
      units_total: 531,
      sources_total: 4,
    });
    await reporter.beginStage("validating", "Validating", 531);

    await reporter.tick(
      "validating",
      "Source 1/4 · batch 3/15 · 75/531 ideas",
      1,
      {
        phase: "validating",
        units_processed: 75,
        batches_done: 3,
        batches_total: 15,
        sources_done: 1,
      },
    );

    const gr = reporter.getGraphRepair();
    expect(gr?.units_processed).toBe(75);
    expect(gr?.batches_done).toBe(3);
    expect(gr?.sources_done).toBe(1);
  });

  it("records last_error via setGraphRepair", async () => {
    const reporter = new ConnectIngestProgressReporter(mockJob());
    reporter.initGraphRepair({
      mode: "validate_and_remediate",
      units_total: 10,
      sources_total: 1,
    });
    await reporter.setGraphRepair({
      last_error: "Route fallback exhausted after: timeout",
      sources_remediation_failed: 1,
    });

    const gr = reporter.getGraphRepair();
    expect(gr?.last_error).toContain("timeout");
    expect(gr?.last_error_at).toBeTruthy();
    expect(gr?.sources_remediation_failed).toBe(1);
  });
});
