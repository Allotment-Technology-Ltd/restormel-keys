/**
 * Live-run SSE — shared transport contract (Stage W3.1).
 *
 * ONE channel for workspace ingest-run state. The server endpoint
 * (`/api/connect/ingest/events`) streams `snapshot` + `delta` + `heartbeat`
 * frames; the client (`LiveRunEventClient`) reconnects by rebuilding its request
 * URL from the consumer's CURRENT cursor and falls back to the existing F8-diet
 * poll after repeated failures.
 *
 * Why short-lived streams + reconnect, not one long socket: the Vercel deploy
 * target is serverless (adapter-vercel, Hobby — single custom region, sub-daily
 * crons rejected → 60s function-duration ceiling). A 10-minute run cannot ride a
 * single function invocation. The endpoint therefore self-closes under the cap
 * and the client reconnects.
 *
 * Resume mechanism (no `Last-Event-ID`): the client builds its URL from a
 * PROVIDER re-evaluated on every connect, so the run console passes its current
 * log `since` cursor on each (re)connect. The server seeds its log cursor from
 * that `?since=` and the FIRST frame after connect is a focused `snapshot` that
 * carries the catch-up `logLines` plus a `since` (the new log cursor). The
 * console advances its `since` from every frame, so a reconnect or hidden-tab
 * gap drops no log lines — the next snapshot replays everything since the cursor
 * the client last acknowledged. On the Coolify target (adapter-node, in flight)
 * the same endpoint holds the whole run with no reconnect churn. One transport,
 * two platforms — see the endpoint's STREAM_BUDGET_MS note and the PR's STOP-gate
 * rationale.
 *
 * This module is framing/parse-only and dependency-free so it unit-tests without
 * timers, network, or a DOM.
 */
import type { LiveRunChipJob } from "$lib/connect/live-run-chip";

/**
 * A run row as carried on the events channel. Superset of `LiveRunChipJob`
 * (the chip's needs) plus the fields the runs list renders. Server emits the
 * same shape `connectIngestJobRecordToApi` produces.
 */
export type LiveRunEventJob = LiveRunChipJob & {
  current_stage?: string;
  reclaim_count?: number;
};

/** Full workspace snapshot — sent on connect and whenever the set churns. */
export type LiveRunSnapshotEvent = {
  type: "snapshot";
  jobs: LiveRunEventJob[];
  /**
   * Focused (run-console) snapshots carry the catch-up log tail: every line with
   * id greater than the `?since=` the client connected with. Absent on workspace
   * snapshots (the chip / runs list don't stream logs).
   */
  logLines?: string[];
  /** Total log-line count for the focused run (honest "N lines" without re-counting). */
  logLineTotal?: number;
  /**
   * New log cursor (the id of the last line in `logLines`, or the cursor the
   * client connected with when there was nothing new). The console advances its
   * `since` from this so the NEXT reconnect resumes exactly here — no gap.
   */
  since?: number;
  /** Monotonic stream sequence (the SSE `id:` line; informational, not used for resume). */
  cursor: number;
};

/** One run's state changed — the cheap steady-state frame for an active run. */
export type LiveRunDeltaEvent = {
  type: "delta";
  job: LiveRunEventJob;
  /** New activity-log lines appended since the last frame (run console tail). */
  logLines?: string[];
  /** Total log-line count for the affected run (honest "N lines" without re-counting). */
  logLineTotal?: number;
  /**
   * New log cursor (id of the last line in `logLines`). The console advances its
   * `since` from this so a fallback fetch / reconnect resumes here without
   * re-appending lines SSE already delivered.
   */
  since?: number;
  cursor: number;
};

/** Keep-alive so proxies don't idle the connection; also carries the live clock. */
export type LiveRunHeartbeatEvent = {
  type: "heartbeat";
  nowMs: number;
  cursor: number;
};

export type LiveRunStreamEvent =
  | LiveRunSnapshotEvent
  | LiveRunDeltaEvent
  | LiveRunHeartbeatEvent;

/** SSE event name used for every data frame (single named event keeps the client simple). */
export const LIVE_RUN_EVENT_NAME = "run";

/**
 * Server stream budget. Self-close before the platform function-duration cap so
 * the client reconnects cleanly rather than being killed mid-frame. 50s sits
 * comfortably under Vercel Hobby's 60s ceiling; adapter-node ignores it as a
 * harmless periodic reconnect.
 */
export const STREAM_BUDGET_MS = 50_000;

/** Server heartbeat cadence — keeps proxies open and refreshes the client clock. */
export const STREAM_HEARTBEAT_MS = 15_000;

/**
 * Server internal data-layer poll cadences (NOT client intervals — each is bounded
 * by STREAM_BUDGET_MS and pauses when the tab is hidden via the client). Tuned to
 * stay at or below the pre-W3.1 pull cost:
 *  - focused (run console) active = 2.5s → equals the old `/status` poll;
 *  - workspace (chip / runs list) active = 5s, idle = 30s → the chip's old 30s
 *    coarse cadence when nothing runs, modestly fresher while a run is active.
 */
export const STREAM_TICK_FOCUSED_ACTIVE_MS = 2_500;
export const STREAM_TICK_FOCUSED_IDLE_MS = 10_000;
export const STREAM_TICK_WORKSPACE_ACTIVE_MS = 5_000;
export const STREAM_TICK_WORKSPACE_IDLE_MS = 30_000;

/** Reconnect backoff the client advertises / honours, in ms. */
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 8_000;
/** Consecutive failed (re)connections before the client declares SSE unhealthy. */
export const RECONNECT_FAILURE_LIMIT = 3;

/**
 * Encode one SSE frame (id + event + data) for the named run event. The `id:`
 * line is the monotonic stream sequence — informational / debuggable. Resume does
 * NOT rely on it (the client doesn't read `Last-Event-ID`): the per-connect URL
 * carries the consumer's current log cursor and the first frame replays the gap.
 */
export function encodeLiveRunFrame(event: LiveRunStreamEvent): string {
  return `id: ${event.cursor}\nevent: ${LIVE_RUN_EVENT_NAME}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** A bare SSE comment line — heartbeat that carries no data (proxy keep-alive). */
export function encodeSseComment(text = "keep-alive"): string {
  return `: ${text}\n\n`;
}

/**
 * Parse a single SSE `data:` payload into a typed event, or `null` if it is not
 * a recognised run frame. Tolerant of malformed JSON (returns null, never throws)
 * so one bad frame cannot tear down the stream.
 */
export function parseLiveRunData(payload: string): LiveRunStreamEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.type === "snapshot" && Array.isArray(obj.jobs) && typeof obj.cursor === "number") {
    return {
      type: "snapshot",
      jobs: obj.jobs as LiveRunEventJob[],
      ...(Array.isArray(obj.logLines) ? { logLines: obj.logLines as string[] } : {}),
      ...(typeof obj.logLineTotal === "number" ? { logLineTotal: obj.logLineTotal } : {}),
      ...(typeof obj.since === "number" ? { since: obj.since } : {}),
      cursor: obj.cursor,
    };
  }
  if (obj.type === "delta" && obj.job && typeof obj.cursor === "number") {
    return {
      type: "delta",
      job: obj.job as LiveRunEventJob,
      ...(Array.isArray(obj.logLines) ? { logLines: obj.logLines as string[] } : {}),
      ...(typeof obj.logLineTotal === "number" ? { logLineTotal: obj.logLineTotal } : {}),
      ...(typeof obj.since === "number" ? { since: obj.since } : {}),
      cursor: obj.cursor,
    };
  }
  if (obj.type === "heartbeat" && typeof obj.nowMs === "number" && typeof obj.cursor === "number") {
    return { type: "heartbeat", nowMs: obj.nowMs, cursor: obj.cursor };
  }
  return null;
}

/** Compute the next reconnect delay (exponential backoff, capped). */
export function reconnectDelayMs(attempt: number): number {
  const base = RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(base, RECONNECT_MAX_MS);
}
