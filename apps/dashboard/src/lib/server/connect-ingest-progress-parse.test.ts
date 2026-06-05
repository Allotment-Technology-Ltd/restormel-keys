import { describe, expect, it } from "vitest";
import { connectIngestJobRecordToApi } from "$lib/server/connect-ingest-jobs";
import type { ConnectIngestJobRecord } from "$lib/server/neon";

describe("connectIngestJobProgress graph_repair round-trip", () => {
  it("preserves graph_repair fields through connectIngestJobRecordToApi", () => {
    const row: ConnectIngestJobRecord = {
      id: "j1",
      workspaceId: "ws",
      projectId: null,
      status: "running",
      label: "Repair",
      currentStage: "validating",
      currentAction: "batch 2/5",
      progress: {
        percent: 40,
        processed: 200,
        total: 500,
        execution_mode: "full",
        graph_repair: {
          job_kind: "graph_revalidate",
          mode: "validate_and_remediate",
          phase: "validating",
          units_total: 500,
          units_processed: 200,
          sources_total: 4,
          sources_done: 1,
          batches_total: 22,
          batches_done: 5,
          repaired: 3,
          dropped: 1,
          preview_only_sources: 1,
          sources_remediation_failed: 0,
          last_activity_at: "2026-06-05T12:00:00.000Z",
        },
      },
      stages: [],
      sources: [],
      stopAfterStage: null,
      pipelineProfileId: null,
      domainPackId: null,
      graphTargetId: null,
      error: null,
      createdAt: 1,
      updatedAt: 2,
    };

    const api = connectIngestJobRecordToApi(row);
    expect(api.progress?.graph_repair?.units_total).toBe(500);
    expect(api.progress?.graph_repair?.batches_done).toBe(5);
    expect(api.progress?.graph_repair?.preview_only_sources).toBe(1);
    expect(api.progress?.processed).toBe(200);
  });
});
