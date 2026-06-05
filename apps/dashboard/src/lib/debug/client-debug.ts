// Use typeof window to check for browser environment instead of $app/environment
// to avoid SSR issues where $app/environment might not be available.
const browser = typeof window !== "undefined";
const dev = import.meta.env.DEV;

export const CLIENT_DEBUG_STORAGE_KEY = "rm-client-debug-v1";
const MAX_BUFFER = 80;

export type ClientDebugEvent = {
  channel: "client";
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  runId?: string;
  timestamp: number;
};

export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  cause?: SerializedError | string;
};

/** Normalize any thrown value for logging (truncate stacks only in storage, not in file POST). */
export function serializeError(error: unknown, maxStackLines = 40): SerializedError {
  if (error instanceof Error) {
    const cause =
      error.cause !== undefined
        ? typeof error.cause === "object" && error.cause !== null
          ? serializeError(error.cause, 12)
          : String(error.cause)
        : undefined;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, maxStackLines).join("\n"),
      cause,
    };
  }
  return { name: "NonError", message: String(error) };
}

function readBuffer(): ClientDebugEvent[] {
  if (!browser) return [];
  try {
    const raw = sessionStorage.getItem(CLIENT_DEBUG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ClientDebugEvent[]) : [];
  } catch {
    return [];
  }
}

function writeBuffer(events: ClientDebugEvent[]): void {
  if (!browser) return;
  try {
    sessionStorage.setItem(
      CLIENT_DEBUG_STORAGE_KEY,
      JSON.stringify(events.slice(-MAX_BUFFER))
    );
  } catch {
    // quota or private mode
  }
}

function pushToBuffer(event: ClientDebugEvent): void {
  const next = [...readBuffer(), event].slice(-MAX_BUFFER);
  writeBuffer(next);
}

function postToDevApi(event: ClientDebugEvent): void {
  const body = JSON.stringify({
    sessionId: "3ca71a",
    channel: "client-api",
    location: event.location,
    message: event.message,
    data: event.data,
    hypothesisId: event.hypothesisId,
    runId: event.runId,
    timestamp: event.timestamp,
  });
  const url = "/api/dev/client-debug";
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
  } catch {
    // fall through
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Report a client-side diagnostic event. Always mirrors to console + sessionStorage in dev;
 * also POSTs to `/api/dev/client-debug` for durable NDJSON on disk.
 */
export function reportClientDebug(
  location: string,
  message: string,
  data?: Record<string, unknown>,
  hypothesisId = "CX",
  runId = "capture"
): void {
  if (!browser) return;

  const event: ClientDebugEvent = {
    channel: "client",
    location,
    message,
    data,
    hypothesisId,
    runId,
    timestamp: Date.now(),
  };

  pushToBuffer(event);

  if (dev) {
    console.error(
      `[restormel-client-debug] ${location} — ${message}`,
      data ?? ""
    );
    postToDevApi(event);
  }
}

export function reportClientError(
  location: string,
  error: unknown,
  extra?: Record<string, unknown>,
  hypothesisId = "CX-ERR"
): void {
  const payload = {
    ...extra,
    error: serializeError(error, 80),
  };
  // Always echo to console — survives failed ingest / API posts.
  console.error(`[restormel-client-debug] ${location}`, payload);
  reportClientDebug(location, "error captured", payload, hypothesisId, "capture");
}

/** Dump buffer to console; callable from DevTools as `window.__rmClientDebugDump()`. */
export function dumpClientDebugBuffer(): ClientDebugEvent[] {
  const events = readBuffer();
  console.table(events);
  return events;
}

let captureInstalled = false;

/**
 * Install global capture hooks once: window errors, rejections, fetch failures, SvelteKit page errors.
 */
export function setupClientDebugCapture(): void {
  if (!browser || !dev || captureInstalled) return;
  captureInstalled = true;

  reportClientDebug("client-debug.ts:init", "capture hooks installed", {
    href: location.href,
    userAgent: navigator.userAgent.slice(0, 120),
  });

  window.addEventListener(
    "error",
    (ev) => {
      reportClientError("window:error", ev.error ?? ev.message, {
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
      });
    },
    true
  );

  window.addEventListener("unhandledrejection", (ev) => {
    reportClientError("window:unhandledrejection", ev.reason);
  });

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : String(input);
    const started = performance.now();
    try {
      const res = await origFetch(input, init);
      if (!res.ok) {
        let bodySnippet: string | undefined;
        try {
          const clone = res.clone();
          const text = await clone.text();
          bodySnippet = text.slice(0, 500);
        } catch {
          bodySnippet = undefined;
        }
        reportClientDebug(
          "fetch:non-ok",
          `${res.status} ${res.statusText}`,
          {
            url: url.slice(0, 500),
            status: res.status,
            ms: Math.round(performance.now() - started),
            bodySnippet,
          },
          "CX-FETCH"
        );
      }
      return res;
    } catch (e) {
      reportClientError("fetch:throw", e, {
        url: url.slice(0, 500),
        ms: Math.round(performance.now() - started),
      });
      throw e;
    }
  };

  (window as Window & { __rmClientDebugDump?: () => ClientDebugEvent[] }).__rmClientDebugDump =
    dumpClientDebugBuffer;
}
