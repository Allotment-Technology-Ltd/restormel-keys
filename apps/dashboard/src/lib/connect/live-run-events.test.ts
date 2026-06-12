import { describe, it, expect } from "vitest";
import {
  encodeLiveRunFrame,
  encodeSseComment,
  parseLiveRunData,
  reconnectDelayMs,
  LIVE_RUN_EVENT_NAME,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  type LiveRunStreamEvent,
} from "./live-run-events";

const snapshot: LiveRunStreamEvent = {
  type: "snapshot",
  cursor: 7,
  jobs: [
    {
      id: "run-1",
      status: "running",
      created_at: "2026-06-12T10:00:00.000Z",
      progress: { percent: 40 },
      worker_heartbeat_at: 123,
      lease_expires_at: 456,
    },
  ],
};

describe("encodeLiveRunFrame", () => {
  it("emits id + named event + JSON data, blank-line terminated", () => {
    const frame = encodeLiveRunFrame(snapshot);
    expect(frame).toContain(`id: 7\n`);
    expect(frame).toContain(`event: ${LIVE_RUN_EVENT_NAME}\n`);
    expect(frame.endsWith("\n\n")).toBe(true);
    const dataLine = frame.split("\n").find((l) => l.startsWith("data: "))!;
    expect(JSON.parse(dataLine.slice(6))).toEqual(snapshot);
  });

  it("round-trips through parseLiveRunData", () => {
    const frame = encodeLiveRunFrame(snapshot);
    const dataLine = frame.split("\n").find((l) => l.startsWith("data: "))!;
    expect(parseLiveRunData(dataLine.slice(6))).toEqual(snapshot);
  });
});

describe("encodeSseComment", () => {
  it("is a colon-prefixed comment terminated by a blank line", () => {
    expect(encodeSseComment("hb")).toBe(": hb\n\n");
  });
});

describe("parseLiveRunData", () => {
  it("parses delta with log lines", () => {
    const delta: LiveRunStreamEvent = {
      type: "delta",
      cursor: 9,
      job: { id: "r", status: "running", created_at: "2026-06-12T10:00:00.000Z" },
      logLines: ["[INGEST] queued", "[INGEST] working"],
      logLineTotal: 2,
    };
    expect(parseLiveRunData(JSON.stringify(delta))).toEqual(delta);
  });

  it("parses heartbeat", () => {
    const hb: LiveRunStreamEvent = { type: "heartbeat", nowMs: 1_000, cursor: 3 };
    expect(parseLiveRunData(JSON.stringify(hb))).toEqual(hb);
  });

  it("returns null for malformed JSON (one bad frame never throws)", () => {
    expect(parseLiveRunData("{not json")).toBeNull();
    expect(parseLiveRunData("")).toBeNull();
  });

  it("returns null for an unknown / incomplete shape", () => {
    expect(parseLiveRunData(JSON.stringify({ type: "snapshot" }))).toBeNull(); // no jobs/cursor
    expect(parseLiveRunData(JSON.stringify({ type: "delta", cursor: 1 }))).toBeNull(); // no job
    expect(parseLiveRunData(JSON.stringify({ type: "nope", cursor: 1 }))).toBeNull();
    expect(parseLiveRunData("42")).toBeNull();
  });
});

describe("reconnectDelayMs", () => {
  it("backs off exponentially from the base", () => {
    expect(reconnectDelayMs(1)).toBe(RECONNECT_BASE_MS);
    expect(reconnectDelayMs(2)).toBe(RECONNECT_BASE_MS * 2);
    expect(reconnectDelayMs(3)).toBe(RECONNECT_BASE_MS * 4);
  });
  it("caps at the max", () => {
    expect(reconnectDelayMs(20)).toBe(RECONNECT_MAX_MS);
  });
  it("clamps non-positive attempts to the base", () => {
    expect(reconnectDelayMs(0)).toBe(RECONNECT_BASE_MS);
    expect(reconnectDelayMs(-5)).toBe(RECONNECT_BASE_MS);
  });
});
