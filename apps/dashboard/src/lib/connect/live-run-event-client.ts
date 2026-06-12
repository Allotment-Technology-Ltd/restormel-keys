/**
 * Live-run SSE client (Stage W3.1).
 *
 * Wraps `EventSource` with:
 *  - auto-reconnect on close/error (the server self-closes at STREAM_BUDGET_MS so
 *    a normal run produces periodic clean reconnects — `Last-Event-ID` resumes the
 *    cursor, native to EventSource);
 *  - a consecutive-failure counter: after RECONNECT_FAILURE_LIMIT failed connects
 *    in a row with no successful frame between, it calls `onFallback()` so the
 *    consumer can engage the existing F8-diet poll (one transport, degraded note);
 *  - tab-visibility pause (no open socket while hidden — matches the poll diet).
 *
 * Why a class wrapping EventSource (not the fetch-reader the proof stream uses):
 * EventSource gives us reconnect + `Last-Event-ID` resumption for free, which is
 * exactly the seam the serverless budget needs. The proof stream is a one-shot
 * POST body; this is a long-lived idempotent GET.
 *
 * Injectable EventSource factory keeps it unit-testable with a fake.
 */
import {
  parseLiveRunData,
  RECONNECT_FAILURE_LIMIT,
  reconnectDelayMs,
  LIVE_RUN_EVENT_NAME,
  type LiveRunStreamEvent,
} from "$lib/connect/live-run-events";

export type LiveRunEventClientOptions = {
  /** Full URL to the events endpoint (already workspace-scoped by session auth). */
  url: string;
  /** Called for every parsed run frame (snapshot / delta / heartbeat). */
  onEvent: (event: LiveRunStreamEvent) => void;
  /** Called once when SSE is judged unhealthy — consumer should start polling. */
  onFallback?: () => void;
  /** Called when a healthy connection (re)opens — consumer can stop any fallback poll. */
  onLive?: () => void;
  /**
   * EventSource constructor (default `globalThis.EventSource`). Tests inject a fake;
   * SSR passes nothing and `start()` no-ops because the default is undefined.
   */
  eventSourceFactory?: (url: string) => EventSourceLike;
  /** Pause while the tab is hidden. Default true. Tests pass false. */
  pauseWhenHidden?: boolean;
};

/** The slice of the EventSource API this client uses (so a fake can implement it). */
export interface EventSourceLike {
  addEventListener(type: string, listener: (ev: MessageEvent) => void): void;
  onopen: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  close(): void;
}

export class LiveRunEventClient {
  private readonly opts: LiveRunEventClientOptions;
  private readonly factory: ((url: string) => EventSourceLike) | undefined;
  private readonly pauseWhenHidden: boolean;
  private source: EventSourceLike | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveFailures = 0;
  /** A connection that delivered at least one frame counts as healthy. */
  private gotFrameThisConnection = false;
  private fellBack = false;
  private stopped = false;
  private visibilityBound = false;

  constructor(opts: LiveRunEventClientOptions) {
    this.opts = opts;
    this.factory =
      opts.eventSourceFactory ??
      (typeof globalThis !== "undefined" &&
      typeof (globalThis as { EventSource?: unknown }).EventSource === "function"
        ? (url: string) => new (globalThis as unknown as { EventSource: new (u: string) => EventSourceLike }).EventSource(url)
        : undefined);
    this.pauseWhenHidden = opts.pauseWhenHidden ?? true;
  }

  /** True when this environment can open an SSE connection at all. */
  get supported(): boolean {
    return this.factory !== undefined;
  }

  start(): void {
    if (this.stopped) return;
    if (!this.supported) {
      // No EventSource (SSR / very old browser): degrade to fallback immediately.
      this.engageFallback();
      return;
    }
    if (this.pauseWhenHidden && typeof document !== "undefined" && !this.visibilityBound) {
      document.addEventListener("visibilitychange", this.onVisibility);
      this.visibilityBound = true;
    }
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.teardownSource();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.visibilityBound && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
      this.visibilityBound = false;
    }
  }

  private onVisibility = (): void => {
    if (this.stopped) return;
    if (typeof document === "undefined") return;
    if (document.hidden) {
      // Close the socket while hidden; reconnect on return (don't count as failure).
      this.teardownSource();
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    } else if (!this.source && !this.fellBack) {
      this.connect();
    } else if (!this.source && this.fellBack) {
      // Came back after falling back — try SSE again from scratch.
      this.fellBack = false;
      this.consecutiveFailures = 0;
      this.connect();
    }
  };

  private connect(): void {
    if (this.stopped || this.source || !this.factory) return;
    if (this.pauseWhenHidden && typeof document !== "undefined" && document.hidden) return;
    this.gotFrameThisConnection = false;
    const source = this.factory(this.opts.url);
    this.source = source;
    source.addEventListener(LIVE_RUN_EVENT_NAME, this.onMessage);
    source.onopen = this.onOpen;
    source.onerror = this.onError;
  }

  private onOpen = (): void => {
    // `open` alone isn't "healthy" — we require a frame (the server may open then
    // 401-close). Treat open as provisional; onMessage confirms health.
  };

  private onMessage = (ev: MessageEvent): void => {
    const event = parseLiveRunData(typeof ev.data === "string" ? ev.data : "");
    if (!event) return;
    if (!this.gotFrameThisConnection) {
      this.gotFrameThisConnection = true;
      this.consecutiveFailures = 0;
      if (this.fellBack) {
        this.fellBack = false;
      }
      this.opts.onLive?.();
    }
    this.opts.onEvent(event);
  };

  private onError = (): void => {
    // EventSource fires error on disconnect (including the server's budget close).
    // If we received a frame this connection, it was a healthy stream that simply
    // rotated — reconnect without penalty. Otherwise it's a failed connect.
    const wasHealthy = this.gotFrameThisConnection;
    this.teardownSource();
    if (this.stopped) return;
    if (!wasHealthy) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= RECONNECT_FAILURE_LIMIT) {
        this.engageFallback();
        return;
      }
    }
    this.scheduleReconnect(wasHealthy ? 1 : this.consecutiveFailures);
  };

  private scheduleReconnect(attempt: number): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, reconnectDelayMs(attempt));
  }

  private engageFallback(): void {
    if (this.fellBack) return;
    this.fellBack = true;
    this.teardownSource();
    this.opts.onFallback?.();
  }

  private teardownSource(): void {
    if (this.source) {
      try {
        this.source.close();
      } catch {
        /* noop */
      }
      this.source = null;
    }
  }
}
