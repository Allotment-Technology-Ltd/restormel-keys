import { describe, expect, it } from "vitest";
import {
  extractRecentBracketTaggedLines,
  formatBracketLogLine,
} from "$lib/connect/bracket-log-timeline";
import {
  computeConnectIngestEtaSeconds,
  formatEta,
  buildStageProgressMetrics,
} from "$lib/server/connect-ingest-progress";

describe("bracket-log-timeline", () => {
  it("formats bracket lines", () => {
    expect(formatBracketLogLine("extract", "Chunk 1/3")).toBe("[EXTRACT] Chunk 1/3");
  });

  it("extracts tagged lines from a tail buffer", () => {
    const lines = ["plain", "[INGEST] Queued", "[EXTRACT] Starting"];
    expect(extractRecentBracketTaggedLines(lines)).toEqual([
      { tag: "INGEST", body: "Queued", raw: "[INGEST] Queued" },
      { tag: "EXTRACT", body: "Starting", raw: "[EXTRACT] Starting" },
    ]);
  });
});

describe("connect-ingest-progress", () => {
  it("estimates ETA from processed rate", () => {
    const started = Date.now() - 4000;
    const eta = computeConnectIngestEtaSeconds({
      runStartedAtMs: started,
      processed: 2,
      total: 8,
      nowMs: Date.now(),
    });
    expect(eta).toBeGreaterThan(0);
  });

  it("builds per-stage metrics with ETA", () => {
    const started = Date.now() - 3000;
    const metrics = buildStageProgressMetrics({
      processed: 1,
      total: 4,
      startedAtMs: started,
      nowMs: Date.now(),
    });
    expect(metrics.percent).toBe(25);
    expect(metrics.processed).toBe(1);
    expect(metrics.total).toBe(4);
    expect(metrics.eta_seconds).toBeGreaterThan(0);
  });

  it("formats ETA for display", () => {
    expect(formatEta(45)).toBe("45s");
    expect(formatEta(125)).toBe("2m 5s");
  });
});
