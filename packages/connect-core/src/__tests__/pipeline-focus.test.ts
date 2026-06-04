import { describe, expect, it } from "vitest";
import {
  applyConnectPipelineFocus,
  buildConnectPipelineStageRows,
  connectIngestProgressFromLogLine,
  connectStageFromBracketTag,
} from "../ingest/pipeline-focus.js";
import { normalizeConnectIngestStages } from "../ingest/worker-stub.js";

describe("applyConnectPipelineFocus", () => {
  it("marks prior stages completed and later stages pending", () => {
    const base = normalizeConnectIngestStages([
      { stage: "extracting", status: "running" },
    ]);
    const { stages, currentStage, currentAction } = applyConnectPipelineFocus(
      base,
      "grouping",
      "Grouping 80 units",
    );
    expect(currentStage).toBe("grouping");
    expect(currentAction).toBe("Grouping 80 units");
    expect(stages.find((s) => s.stage === "extracting")?.status).toBe("completed");
    expect(stages.find((s) => s.stage === "relating")?.status).toBe("completed");
    expect(stages.find((s) => s.stage === "grouping")?.status).toBe("running");
    expect(stages.find((s) => s.stage === "embedding")?.status).toBe("pending");
  });

  it("allows only one running stage", () => {
    const base = normalizeConnectIngestStages([
      { stage: "extracting", status: "running" },
      { stage: "relating", status: "running" },
    ]);
    const { stages } = applyConnectPipelineFocus(base, "embedding", "[EMBED] Embedding vectors");
    const running = stages.filter((s) => s.status === "running");
    expect(running).toHaveLength(1);
    expect(running[0]?.stage).toBe("embedding");
  });
});

describe("connectIngestProgressFromLogLine", () => {
  it("maps bracket tags to stages", () => {
    expect(connectStageFromBracketTag("GROUP")).toBe("grouping");
    expect(connectIngestProgressFromLogLine("[GROUP] Grouping 80 units")).toEqual({
      stage: "grouping",
      summaryLine: "[GROUP] Grouping 80 units",
    });
  });
});

describe("buildConnectPipelineStageRows", () => {
  it("flags current stage from currentStageKey only", () => {
    const stages = normalizeConnectIngestStages([
      { stage: "extracting", status: "completed" },
      { stage: "grouping", status: "running" },
    ]);
    const rows = buildConnectPipelineStageRows(stages, "grouping");
    expect(rows.find((r) => r.key === "grouping")?.isCurrent).toBe(true);
    expect(rows.find((r) => r.key === "extracting")?.isCurrent).toBe(false);
  });
});
