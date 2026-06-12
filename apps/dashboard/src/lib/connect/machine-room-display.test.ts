/**
 * W4.1 Machine Room display logic — pure unit tests.
 *
 * Covers the three projections the run console renders from existing SSE state:
 *  - per-stage odometer accumulation from a mocked stage-progress stream;
 *  - the heartbeat tick-line model (advance + stall + static age fallback);
 *  - the single completion-ledger verdict (B-P1-1), built ONCE from quality numbers.
 */
import { describe, it, expect } from "vitest";
import type { ConnectIngestStageProgress } from "@restormel/connect-core/ingest/worker-stub";
import {
  buildHeartbeatStrip,
  buildStageOdometers,
  buildCompletionLedger,
  formatSignalAge,
  HEARTBEAT_CELLS,
} from "./machine-room-display";

function stage(
  s: ConnectIngestStageProgress["stage"],
  status: ConnectIngestStageProgress["status"],
  processed?: number,
  total?: number,
): ConnectIngestStageProgress {
  return {
    stage: s,
    status,
    ...(processed != null
      ? { progress: { percent: 0, processed, total: total ?? 1 } }
      : {}),
  };
}

describe("buildStageOdometers", () => {
  it("returns empty for no stages", () => {
    expect(buildStageOdometers(null, null)).toEqual([]);
    expect(buildStageOdometers([], "extracting")).toEqual([]);
  });

  it("projects per-stage processed counts in canonical order, skipping skipped", () => {
    const stages = [
      stage("extracting", "completed", 412, 412),
      stage("relating", "completed", 300, 300),
      stage("grouping", "skipped"),
      stage("validating", "running", 367, 412),
    ];
    const rows = buildStageOdometers(stages, "validating");
    // grouping is skipped → omitted; order follows the canonical pipeline.
    expect(rows.map((r) => r.stage)).toEqual(["extracting", "relating", "validating"]);
    const validate = rows.find((r) => r.stage === "validating")!;
    expect(validate.count).toBe(367);
    expect(validate.total).toBe(412);
    expect(validate.running).toBe(true);
    expect(validate.label).toBe("Validate");
  });

  it("counts UP as successive stream frames raise processed (live accumulation)", () => {
    // Simulate the delta stream the console applies frame by frame.
    const frames = [10, 120, 367, 412];
    const counts = frames.map((p) => {
      const rows = buildStageOdometers([stage("extracting", "running", p, 412)], "extracting");
      return rows[0]!.count;
    });
    expect(counts).toEqual([10, 120, 367, 412]);
    // Monotonic non-decreasing — the odometer never goes backwards across frames.
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
    }
  });

  it("shows honest 0 (not a guess) when a stage has no progress metrics yet", () => {
    const rows = buildStageOdometers([stage("extracting", "running")], "extracting");
    expect(rows[0]!.count).toBe(0);
    expect(rows[0]!.total).toBeNull();
  });

  it("does not surface a total of 1 as a denominator", () => {
    const rows = buildStageOdometers([stage("storing", "running", 1, 1)], "storing");
    expect(rows[0]!.total).toBeNull();
  });
});

describe("buildHeartbeatStrip", () => {
  it("advances the filled cell as the applied-frame tick increases", () => {
    const base = {
      workerHeartbeatAt: 1_000,
      nowMs: 4_000,
      stalled: false,
    };
    const bars = [0, 1, 2, 3, 4, 5].map(
      (tick) => buildHeartbeatStrip({ ...base, tick }).bar,
    );
    // Each tick walks the filled cell; bars cycle through distinct fills.
    expect(new Set(bars).size).toBeGreaterThan(1);
    // Bar is always HEARTBEAT_CELLS wide.
    for (const b of bars) expect([...b].length).toBe(HEARTBEAT_CELLS);
  });

  it("renders a full amber-ready bar and surfaces stall when stalled", () => {
    const hb = buildHeartbeatStrip({
      workerHeartbeatAt: 1_000,
      nowMs: 200_000,
      tick: 2,
      stalled: true,
    });
    expect(hb.stalled).toBe(true);
    expect(hb.filled).toBe(HEARTBEAT_CELLS);
    expect(hb.bar).toBe("▮".repeat(HEARTBEAT_CELLS));
  });

  it("computes the static signal-age fallback from the heartbeat", () => {
    const hb = buildHeartbeatStrip({
      workerHeartbeatAt: 1_000,
      nowMs: 5_000,
      tick: 0,
      stalled: false,
    });
    expect(hb.signalAgeMs).toBe(4_000);
    expect(hb.signalAgeLabel).toBe("4s ago");
  });

  it("falls back to updated_at when there is no heartbeat column (legacy rows)", () => {
    const hb = buildHeartbeatStrip({
      workerHeartbeatAt: null,
      updatedAtIso: new Date(10_000).toISOString(),
      nowMs: 130_000,
      tick: 1,
      stalled: false,
    });
    expect(hb.signalAgeLabel).toBe("2m ago");
  });

  it("returns an em-dash age when nothing is known", () => {
    const hb = buildHeartbeatStrip({ workerHeartbeatAt: null, nowMs: 1_000, tick: 0, stalled: false });
    expect(hb.signalAgeLabel).toBe("—");
    expect(hb.signalAgeMs).toBeNull();
  });
});

describe("formatSignalAge", () => {
  it("humanises ms ages with honest absence", () => {
    expect(formatSignalAge(null)).toBe("—");
    expect(formatSignalAge(-5)).toBe("just now");
    expect(formatSignalAge(3_000)).toBe("3s ago");
    expect(formatSignalAge(120_000)).toBe("2m ago");
    expect(formatSignalAge(7_200_000)).toBe("2h ago");
  });
});

describe("buildCompletionLedger", () => {
  it("formats a strong run's verdict cap (quoting the quality numbers)", () => {
    const ledger = buildCompletionLedger({ trustScore: 88, okPct: 92, totalUnits: 412 });
    expect(ledger.trustScore).toBe("88");
    expect(ledger.verdict).toBe("Strong");
    expect(ledger.trustTint).toBe("green");
    expect(ledger.supportedPct).toBe("92");
    expect(ledger.supportedTint).toBe("green");
    expect(ledger.totalUnits).toBe("412");
    expect(ledger.isThisRunAudit).toBe(true);
  });

  it("classifies a moderate and a low run", () => {
    expect(buildCompletionLedger({ trustScore: 72, okPct: 65 }).verdict).toBe("Moderate");
    expect(buildCompletionLedger({ trustScore: 72, okPct: 65 }).trustTint).toBe("yellow");
    expect(buildCompletionLedger({ trustScore: 41, okPct: 30 }).verdict).toBe("Needs attention");
    expect(buildCompletionLedger({ trustScore: 41, okPct: 30 }).trustTint).toBe("red");
    expect(buildCompletionLedger({ trustScore: 41, okPct: 30 }).supportedTint).toBe("red");
  });

  it("reuses the scorecard descriptor thresholds (not a forked copy)", () => {
    // 60/80 trust, 50/80 supported boundaries come from ingest-quality-display.ts.
    expect(buildCompletionLedger({ trustScore: 80, okPct: 80 }).trustTint).toBe("green");
    expect(buildCompletionLedger({ trustScore: 79, okPct: 79 }).trustTint).toBe("yellow");
    expect(buildCompletionLedger({ trustScore: 60, okPct: 50 }).supportedTint).toBe("yellow");
    expect(buildCompletionLedger({ trustScore: 60, okPct: 49 }).supportedTint).toBe("red");
  });

  it("renders honest absence when numbers were not reported (no fabricated score)", () => {
    const ledger = buildCompletionLedger({ trustScore: null, okPct: null, totalUnits: null });
    expect(ledger.trustScore).toBe("—");
    expect(ledger.trustTint).toBe("muted");
    expect(ledger.verdict).toBe("Recorded");
    // MINOR-3: null okPct is honest "—" + muted, NOT a fabricated 0 in red.
    expect(ledger.supportedPct).toBe("—");
    expect(ledger.supportedTint).toBe("muted");
    expect(ledger.totalUnits).toBe("—");
  });
});
