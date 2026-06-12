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
});
