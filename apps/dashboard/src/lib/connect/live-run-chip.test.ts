import { describe, it, expect } from "vitest";
import {
  deriveLiveRunChip,
  formatChipElapsed,
  isLiveRunStalled,
  CHIP_STALL_NOTICE_MS,
  type LiveRunChipJob,
} from "./live-run-chip";

const now = 1_000_000_000_000;
const isoAt = (ms: number) => new Date(ms).toISOString();

function job(o: Partial<LiveRunChipJob> = {}): LiveRunChipJob {
  return {
    id: "r",
    status: "running",
    created_at: isoAt(now - 161_000),
    progress: { percent: 62 },
    worker_heartbeat_at: now,
    lease_expires_at: now + 60_000,
    ...o,
  };
}

describe("formatChipElapsed", () => {
  it("formats m:ss", () => {
    expect(formatChipElapsed(161_000)).toBe("2:41");
    expect(formatChipElapsed(5_000)).toBe("0:05");
    expect(formatChipElapsed(0)).toBe("0:00");
  });
  it("clamps negatives and non-finite", () => {
    expect(formatChipElapsed(-50)).toBe("0:00");
    expect(formatChipElapsed(Number.NaN)).toBe("0:00");
  });
});

describe("isLiveRunStalled", () => {
  it("is false for fresh heartbeat", () => {
    expect(isLiveRunStalled(job(), now)).toBe(false);
  });
  it("is true past the heartbeat threshold", () => {
    expect(
      isLiveRunStalled(job({ worker_heartbeat_at: now - CHIP_STALL_NOTICE_MS - 1, lease_expires_at: null }), now),
    ).toBe(true);
  });
  it("is true when the lease has expired", () => {
    expect(isLiveRunStalled(job({ worker_heartbeat_at: null, lease_expires_at: now - 1 }), now)).toBe(true);
  });
  it("is false for legacy rows with no durable-run columns", () => {
    expect(isLiveRunStalled(job({ worker_heartbeat_at: null, lease_expires_at: null }), now)).toBe(false);
  });
  it("is false for non-active statuses", () => {
    expect(isLiveRunStalled(job({ status: "completed", worker_heartbeat_at: now - 999_999 }), now)).toBe(false);
  });
});

describe("deriveLiveRunChip", () => {
  it("returns null for empty / nullish input", () => {
    expect(deriveLiveRunChip(null, now)).toBeNull();
    expect(deriveLiveRunChip([], now)).toBeNull();
  });
  it("returns null when no run is active", () => {
    expect(deriveLiveRunChip([job({ status: "completed" }), job({ status: "failed" })], now)).toBeNull();
  });
  it("derives percent, elapsed, runId", () => {
    const chip = deriveLiveRunChip([job()], now);
    expect(chip).toMatchObject({ runId: "r", percent: 62, elapsed: "2:41", stalled: false });
  });
  it("clamps out-of-range percent", () => {
    expect(deriveLiveRunChip([job({ progress: { percent: 250 } })], now)?.percent).toBe(100);
    expect(deriveLiveRunChip([job({ progress: { percent: -5 } })], now)?.percent).toBe(0);
  });
  it("picks the most recently created active run", () => {
    const a = job({ id: "a", created_at: isoAt(now - 500_000) });
    const b = job({ id: "b", created_at: isoAt(now - 5_000) });
    expect(deriveLiveRunChip([a, b], now)?.runId).toBe("b");
  });
});
