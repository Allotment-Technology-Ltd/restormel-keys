import { describe, expect, it } from "vitest";
import { normalizeConnectIngestStages } from "@restormel/connect-core";
import {
  reconcileConnectIngestJobStagesForApi,
  resolveIngestStageDisplayStatus,
} from "./ingest-progress-ui";

describe("resolveIngestStageDisplayStatus", () => {
  it("demotes superseded running rows when a later stage is current", () => {
    const status = resolveIngestStageDisplayStatus({
      stageKey: "extracting",
      row: { stage: "extracting", status: "running" },
      jobStatus: "running",
      currentStage: "grouping",
    });
    expect(status).toBe("completed");
  });

  it("shows running only for the current stage key", () => {
    expect(
      resolveIngestStageDisplayStatus({
        stageKey: "grouping",
        row: { stage: "grouping", status: "pending" },
        jobStatus: "running",
        currentStage: "grouping",
      }),
    ).toBe("running");
  });
});

describe("reconcileConnectIngestJobStagesForApi", () => {
  it("re-applies pipeline focus from current stage on read", () => {
    const stages = reconcileConnectIngestJobStagesForApi(
      normalizeConnectIngestStages([{ stage: "extracting", status: "running" }]),
      {
        status: "running",
        currentStage: "grouping",
        currentAction: "Grouping 80 units",
      },
    );
    expect(stages.find((s) => s.stage === "extracting")?.status).toBe("completed");
    expect(stages.find((s) => s.stage === "grouping")?.status).toBe("running");
    expect(stages.filter((s) => s.status === "running")).toHaveLength(1);
  });
});
