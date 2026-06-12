import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LiveRunEventClient,
  type EventSourceLike,
  type LiveRunEventClientOptions,
} from "./live-run-event-client";
import {
  encodeLiveRunFrame,
  LIVE_RUN_EVENT_NAME,
  RECONNECT_FAILURE_LIMIT,
  RECONNECT_MAX_MS,
  reconnectDelayMs,
  type LiveRunStreamEvent,
} from "./live-run-events";

/** A controllable fake EventSource implementing the slice the client uses. */
class FakeEventSource implements EventSourceLike {
  static instances: FakeEventSource[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  private runListeners: Array<(ev: MessageEvent) => void> = [];
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (ev: MessageEvent) => void): void {
    if (type === LIVE_RUN_EVENT_NAME) this.runListeners.push(listener);
  }
  close(): void {
    this.closed = true;
  }
  // Test drivers:
  emit(event: LiveRunStreamEvent): void {
    const frame = encodeLiveRunFrame(event);
    const data = frame.split("\n").find((l) => l.startsWith("data: "))!.slice(6);
    for (const l of this.runListeners) l({ data } as MessageEvent);
  }
  fail(): void {
    this.onerror?.(new Event("error"));
  }
}

const snap = (cursor: number): LiveRunStreamEvent => ({
  type: "snapshot",
  cursor,
  jobs: [{ id: "r", status: "running", created_at: "2026-06-12T10:00:00.000Z" }],
});

function makeClient(over: Partial<LiveRunEventClientOptions> = {}) {
  const onEvent = vi.fn();
  const onFallback = vi.fn();
  const onLive = vi.fn();
  const client = new LiveRunEventClient({
    url: "/events",
    onEvent,
    onFallback,
    onLive,
    pauseWhenHidden: false,
    eventSourceFactory: (url) => new FakeEventSource(url),
    ...over,
  });
  return { client, onEvent, onFallback, onLive };
}

describe("LiveRunEventClient", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("delivers parsed frames and marks the connection live on the first frame", () => {
    const { client, onEvent, onLive } = makeClient();
    client.start();
    const es = FakeEventSource.instances[0]!;
    es.emit(snap(1));
    expect(onEvent).toHaveBeenCalledWith(snap(1));
    expect(onLive).toHaveBeenCalledTimes(1);
    client.stop();
    expect(es.closed).toBe(true);
  });

  it("reconnects without penalty after a healthy stream closes (budget rotation)", () => {
    const { client, onFallback } = makeClient();
    client.start();
    const first = FakeEventSource.instances[0]!;
    first.emit(snap(1)); // healthy
    first.fail(); // server budget close
    // A reconnect is scheduled; advance past the (short, healthy) delay.
    vi.advanceTimersByTime(RECONNECT_MAX_MS + 50);
    expect(FakeEventSource.instances.length).toBe(2);
    expect(onFallback).not.toHaveBeenCalled();
    client.stop();
  });

  it("falls back after RECONNECT_FAILURE_LIMIT failed connects with no frame", () => {
    const { client, onFallback } = makeClient();
    client.start();
    // Each failure with no frame counts; advance the backoff between attempts.
    for (let i = 0; i < RECONNECT_FAILURE_LIMIT; i += 1) {
      const es = FakeEventSource.instances[FakeEventSource.instances.length - 1]!;
      es.fail();
      vi.advanceTimersByTime(RECONNECT_MAX_MS + 50);
    }
    expect(onFallback).toHaveBeenCalledTimes(1);
    client.stop();
  });

  it("a successful frame resets the failure counter (no premature fallback)", () => {
    const { client, onFallback } = makeClient();
    client.start();
    // Two failures, then a healthy connection, then two more failures.
    FakeEventSource.instances[0]!.fail();
    vi.advanceTimersByTime(RECONNECT_MAX_MS + 50);
    FakeEventSource.instances[1]!.fail();
    vi.advanceTimersByTime(RECONNECT_MAX_MS + 50);
    FakeEventSource.instances[2]!.emit(snap(1)); // resets counter
    FakeEventSource.instances[2]!.fail();
    vi.advanceTimersByTime(RECONNECT_MAX_MS + 50);
    FakeEventSource.instances[3]!.fail();
    vi.advanceTimersByTime(RECONNECT_MAX_MS + 50);
    expect(onFallback).not.toHaveBeenCalled();
    client.stop();
  });

  it("engages fallback immediately when EventSource is unavailable", () => {
    const onEvent = vi.fn();
    const onFallback = vi.fn();
    const client = new LiveRunEventClient({
      url: "/events",
      onEvent,
      onFallback,
      pauseWhenHidden: false,
      eventSourceFactory: undefined, // simulate SSR / no EventSource
    });
    expect(client.supported).toBe(false);
    client.start();
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it("stop() prevents further reconnects", () => {
    const { client } = makeClient();
    client.start();
    FakeEventSource.instances[0]!.fail();
    client.stop();
    vi.advanceTimersByTime(RECONNECT_MAX_MS * 5);
    expect(FakeEventSource.instances.length).toBe(1); // no new connection after stop
  });

  it("rebuilds the URL from urlProvider on every (re)connect (cursor resume)", () => {
    // MAJOR-1: the console advances its `since`; each reconnect must carry it.
    let since = 0;
    const { client } = makeClient({
      url: undefined,
      urlProvider: () => `/events?since=${since}`,
    });
    client.start();
    expect(FakeEventSource.instances[0]!.url).toBe("/events?since=0");
    // A healthy frame advances the consumer's cursor, then the budget close fires.
    FakeEventSource.instances[0]!.emit(snap(1));
    since = 42; // console advanced `since` from the frame
    FakeEventSource.instances[0]!.fail();
    vi.advanceTimersByTime(RECONNECT_MAX_MS + 50);
    expect(FakeEventSource.instances.length).toBe(2);
    // The reconnect carries the CURRENT cursor, not the frozen mount-time value.
    expect(FakeEventSource.instances[1]!.url).toBe("/events?since=42");
    client.stop();
  });

  it("reaps a silent (half-open) socket via the staleness watchdog and reconnects", () => {
    // M-7: a socket that opens but then goes silent must not keep claiming "live".
    const { client, onLive } = makeClient({ staleAfterMs: 5_000 });
    client.start();
    const first = FakeEventSource.instances[0]!;
    first.emit(snap(1)); // healthy → onLive fired, watchdog armed
    expect(onLive).toHaveBeenCalledTimes(1);
    // No further frames for > staleAfterMs → watchdog treats it as a disconnect
    // and the FIRST socket is closed (reaped) rather than left claiming "live".
    vi.advanceTimersByTime(5_000 + 50);
    expect(first.closed).toBe(true);
    // It was healthy (got a frame), so it reconnects without penalty.
    vi.advanceTimersByTime(reconnectDelayMs(1) + 50);
    expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(2);
    client.stop();
  });

  it("a steadily-beating socket is never reaped by the watchdog", () => {
    const { client, onFallback } = makeClient({ staleAfterMs: 5_000 });
    client.start();
    const es = FakeEventSource.instances[0]!;
    // Heartbeat well within the window keeps the watchdog from firing.
    for (let i = 0; i < 4; i += 1) {
      es.emit({ type: "heartbeat", nowMs: 1_000 * i, cursor: i });
      vi.advanceTimersByTime(4_000);
    }
    expect(FakeEventSource.instances.length).toBe(1); // still the same socket
    expect(onFallback).not.toHaveBeenCalled();
    client.stop();
  });
});
