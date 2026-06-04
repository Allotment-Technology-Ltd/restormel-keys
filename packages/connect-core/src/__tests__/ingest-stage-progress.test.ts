import { describe, expect, it } from "vitest";
import { normalizeConnectIngestStages } from "../ingest/worker-stub.js";

describe("normalizeConnectIngestStages", () => {
  it("fills missing stages and parses JSON strings", () => {
    const raw = JSON.stringify([
      { stage: "extracting", status: "completed" },
      { stage: "relating", status: "running" },
    ]);
    const stages = normalizeConnectIngestStages(raw);
    expect(stages).toHaveLength(7);
    expect(stages[0]?.status).toBe("completed");
    expect(stages[1]?.status).toBe("running");
    expect(stages[2]?.status).toBe("pending");
  });

  it("ignores unknown stage keys", () => {
    const stages = normalizeConnectIngestStages([
      { stage: "extract", status: "completed" },
      { stage: "extracting", status: "completed" },
    ]);
    expect(stages[0]?.status).toBe("completed");
  });
});
