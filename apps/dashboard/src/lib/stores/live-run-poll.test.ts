import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";
import {
  encodeLiveRunFrame,
  LIVE_RUN_EVENT_NAME,
  type LiveRunStreamEvent,
} from "$lib/connect/live-run-events";

// The store guards on `browser` and constructs LiveRunEventClient with the default
// factory (globalThis.EventSource). Mock both so the transport swap is exercised
// without a DOM/network.
vi.mock("$app/environment", () => ({ browser: true }));

class FakeEventSource {
  static last: FakeEventSource | null = null;
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  private listeners: Array<(ev: MessageEvent) => void> = [];
  closed = false;
  constructor(public url: string) {
    FakeEventSource.last = this;
  }
  addEventListener(type: string, listener: (ev: MessageEvent) => void): void {
    if (type === LIVE_RUN_EVENT_NAME) this.listeners.push(listener);
  }
  close(): void {
    this.closed = true;
  }
  emit(event: LiveRunStreamEvent): void {
    const data = encodeLiveRunFrame(event)
      .split("\n")
      .find((l) => l.startsWith("data: "))!
      .slice(6);
    for (const l of this.listeners) l({ data } as MessageEvent);
  }
  fail(): void {
    this.onerror?.(new Event("error"));
  }
}

const job = (id: string, percent: number, status = "running") => ({
  id,
  status,
  created_at: "2026-06-12T10:00:00.000Z",
  progress: { percent },
});

describe("live-run-poll transport swap (SSE)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource as unknown;
    FakeEventSource.last = null;
    vi.resetModules();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as { EventSource?: unknown }).EventSource;
  });

  it("opens an SSE connection and a snapshot replaces the job set", async () => {
    const mod = await import("./live-run-poll");
    const stop = mod.startLiveRunPoll();
    const es = FakeEventSource.last!;
    expect(es).toBeTruthy();
    expect(es.url).toContain("/api/connect/ingest/events");

    es.emit({ type: "snapshot", cursor: 1, jobs: [job("a", 10), job("b", 20)] });
    expect(get(mod.liveRunJobs)?.map((j) => j.id)).toEqual(["a", "b"]);
    stop();
    expect(es.closed).toBe(true);
  });

  it("a delta patches a single run in place (keeps the others)", async () => {
    const mod = await import("./live-run-poll");
    const stop = mod.startLiveRunPoll();
    const es = FakeEventSource.last!;
    es.emit({ type: "snapshot", cursor: 1, jobs: [job("a", 10), job("b", 20)] });
    es.emit({ type: "delta", cursor: 2, job: job("a", 55) });
    const list = get(mod.liveRunJobs)!;
    expect(list.find((j) => j.id === "a")?.progress?.percent).toBe(55);
    expect(list.find((j) => j.id === "b")?.progress?.percent).toBe(20);
    stop();
  });

  it("falls back to the 30s poll after repeated SSE failures and keeps serving the store", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ jobs: [job("fallback", 99)] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./live-run-poll");
    const stop = mod.startLiveRunPoll();

    // Drive three failed connects (no frame between) → fallback engages.
    for (let i = 0; i < 3; i += 1) {
      FakeEventSource.last!.fail();
      await vi.advanceTimersByTimeAsync(9_000);
    }
    // The fallback poll fired at least one fetch against the jobs BFF.
    expect(fetchMock).toHaveBeenCalled();
    await vi.runOnlyPendingTimersAsync();
    expect(get(mod.liveRunJobs)?.[0]?.id).toBe("fallback");
    stop();
    vi.unstubAllGlobals();
  });
});
