import { describe, expect, it } from "vitest";
import {
  advanceConnectIngestStagesBookkeeping,
  validateConnectIngestSources,
} from "../ingest/worker-stub.js";
import { CONNECT_INGEST_PIPELINE_STAGES } from "../ingest/job-record.js";

describe("worker-stub", () => {
  it("validates sources require url or text", () => {
    expect(() => validateConnectIngestSources([])).toThrow("ingest_sources_required");
    expect(() => validateConnectIngestSources([{}])).toThrow("ingest_source_empty");
    expect(validateConnectIngestSources([{ text: "hello" }])).toHaveLength(1);
  });

  it("marks all pipeline stages completed in stub mode", () => {
    const initial = CONNECT_INGEST_PIPELINE_STAGES.map((stage) => ({
      stage,
      status: "pending" as const,
    }));
    const out = advanceConnectIngestStagesBookkeeping({
      stages: initial,
      mode: "stub_complete",
      now: new Date("2026-06-01T12:00:00.000Z"),
    });
    expect(out.status).toBe("completed");
    expect(out.stages.every((s) => s.status === "completed")).toBe(true);
  });
});
