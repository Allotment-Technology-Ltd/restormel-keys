import { describe, expect, it } from "vitest";
import {
  advanceConnectIngestStagesBookkeeping,
  normalizeConnectIngestStages,
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

  it("preserves a backoff overlay on a running stage across the JSONB round-trip", () => {
    const raw = [
      {
        stage: "extracting",
        status: "running",
        backoff: { reason_code: "rate_limit", attempt: 2, delay_ms: 2000, at: "2026-06-28T10:00:00.000Z" },
      },
    ];
    const normalized = normalizeConnectIngestStages(JSON.stringify(raw));
    const extracting = normalized.find((s) => s.stage === "extracting");
    expect(extracting?.backoff).toEqual({
      reason_code: "rate_limit",
      attempt: 2,
      delay_ms: 2000,
      at: "2026-06-28T10:00:00.000Z",
    });
  });

  it("drops a stale backoff overlay once the stage has settled (never amber after done)", () => {
    const raw = [
      {
        stage: "extracting",
        status: "completed",
        backoff: { reason_code: "rate_limit", attempt: 2, delay_ms: 2000, at: "2026-06-28T10:00:00.000Z" },
      },
    ];
    const normalized = normalizeConnectIngestStages(raw);
    expect(normalized.find((s) => s.stage === "extracting")?.backoff).toBeUndefined();
  });

  it("ignores a malformed backoff overlay", () => {
    const raw = [{ stage: "extracting", status: "running", backoff: { reason_code: "bogus" } }];
    const normalized = normalizeConnectIngestStages(raw);
    expect(normalized.find((s) => s.stage === "extracting")?.backoff).toBeUndefined();
  });
});
