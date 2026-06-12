// @vitest-environment jsdom
/**
 * Run console live-transport boundary tests (W3.1 / MAJOR-2 + MAJOR-3).
 *
 * The console wires a `LiveRunEventClient` and a fallback poll. We mock the client
 * to capture its callbacks (`onEvent` / `onFallback`) and its per-connect
 * `urlProvider`, mock `$app/navigation` to spy on `invalidate`, and stub `fetch`
 * so we can:
 *  - MAJOR-2: assert that after SSE delivers log lines, the fallback fetch uses the
 *    ADVANCED `since` cursor (no re-append of delivered lines), and the rendered
 *    log shows each line exactly once across the SSE→poll boundary;
 *  - MAJOR-3: assert that a `completed` job arriving via a reconnect SNAPSHOT
 *    invalidates the graph/hub caches (not only the delta path).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import type { LiveRunStreamEvent } from "$lib/connect/live-run-events";

// ── Capture the LiveRunEventClient the console constructs ─────────────────────
type Captured = {
  urlProvider?: () => string;
  url?: string;
  onEvent: (e: LiveRunStreamEvent) => void;
  onFallback?: () => void;
  onLive?: () => void;
};
let captured: Captured | null = null;
vi.mock("$lib/connect/live-run-event-client", () => ({
  LiveRunEventClient: class {
    constructor(opts: Captured) {
      captured = opts;
    }
    start() {}
    stop() {}
  },
}));

const invalidateMock = vi.fn();
vi.mock("$app/navigation", () => ({
  invalidate: (...a: unknown[]) => invalidateMock(...a),
  goto: vi.fn(),
}));

import ConnectIngestRunConsole from "./ConnectIngestRunConsole.svelte";

const STATUS_BASE = "/keys/dashboard/api/connect/ingest/jobs/run-1/status";

function statusResponse(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

describe("ConnectIngestRunConsole live transport boundary", () => {
  beforeEach(() => {
    captured = null;
    invalidateMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("MAJOR-2: fallback fetch resumes from the SSE-advanced cursor (no duplicate tail)", async () => {
    // Initial load (loadLive) returns the run + first two log lines, since=2.
    const fetchMock = vi.fn(async (input: string) => {
      const u = String(input);
      if (u.includes("/status")) {
        // Return whatever `since` the URL asked for so we can assert the cursor.
        const since = new URL(u, "http://localhost").searchParams.get("since");
        if (since === "0") {
          return statusResponse({
            job: { id: "run-1", status: "running", progress: { percent: 10 } },
            workspace_id: "ws-1",
            log_lines: ["line 1", "line 2"],
            log_line_total: 2,
            since: 2,
          });
        }
        // Fallback fetch AFTER SSE advanced the cursor — must ask for since=4 and
        // therefore return ONLY new lines (5), never re-sending 3 & 4.
        return statusResponse({
          job: { id: "run-1", status: "running", progress: { percent: 60 } },
          workspace_id: "ws-1",
          log_lines: since === "4" ? ["line 5"] : ["line 3", "line 4", "line 5"],
          log_line_total: 5,
          since: 5,
        });
      }
      return statusResponse({});
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { container } = render(ConnectIngestRunConsole, {
      props: { jobId: "run-1", statusApiBase: STATUS_BASE },
    });
    // Let the onMount + reactive load + startLive run.
    await tick();
    await vi.waitFor(() => expect(captured).not.toBeNull());
    await vi.waitFor(() =>
      expect(container.querySelector(".log-screen-pre")?.textContent).toContain("line 2"),
    );

    // SSE delivers lines 3 & 4 with the advanced cursor since=4.
    captured!.onEvent({
      type: "delta",
      cursor: 2,
      job: { id: "run-1", status: "running", created_at: "2026-06-12T10:00:00.000Z" },
      logLines: ["line 3", "line 4"],
      logLineTotal: 4,
      since: 4,
    });
    await tick();

    // SSE judged unhealthy → fallback poll. It must fetch from since=4.
    captured!.onFallback?.();
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("since=4")),
      ).toBe(true),
    );
    // Wait for the fallback's new line to render before asserting.
    await vi.waitFor(() =>
      expect(container.querySelector(".log-screen-pre")?.textContent).toContain("line 5"),
    );

    const log = container.querySelector(".log-screen-pre")!.textContent!;
    // The fallback fetched from the ADVANCED cursor (since=4), never since=0/2 again.
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("since=2"))).toBe(false);
    // Each line appears exactly once across the SSE→poll boundary (MAJOR-2).
    for (const ln of ["line 1", "line 2", "line 3", "line 4", "line 5"]) {
      expect(log.split(ln).length - 1).toBe(1);
    }
    vi.unstubAllGlobals();
  });

  it("MAJOR-3: a completion arriving via reconnect SNAPSHOT invalidates graph + hub", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (String(input).includes("/status")) {
        // Initial load: run still running (no invalidate yet).
        return statusResponse({
          job: { id: "run-1", status: "running", progress: { percent: 50, execution_mode: "full" } },
          workspace_id: "ws-9",
          log_lines: [],
          log_line_total: 0,
          since: 0,
        });
      }
      return statusResponse({});
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(ConnectIngestRunConsole, {
      props: { jobId: "run-1", statusApiBase: STATUS_BASE, fromGraph: true },
    });
    await tick();
    await vi.waitFor(() => expect(captured).not.toBeNull());

    // No invalidation while the run is in progress.
    expect(invalidateMock).not.toHaveBeenCalled();

    // Completion arrives via a reconnect snapshot (tab hidden during run, returned
    // after finish). The snapshot branch must invalidate (MAJOR-3).
    captured!.onEvent({
      type: "snapshot",
      cursor: 5,
      jobs: [
        {
          id: "run-1",
          status: "completed",
          created_at: "2026-06-12T10:00:00.000Z",
          progress: { percent: 100, execution_mode: "full" },
        } as never,
      ],
      since: 0,
    });
    await tick();

    expect(invalidateMock).toHaveBeenCalledWith("app:connect-graph:ws-9");
    expect(invalidateMock).toHaveBeenCalledWith("app:connect-hub:ws-9");
    vi.unstubAllGlobals();
  });
});
