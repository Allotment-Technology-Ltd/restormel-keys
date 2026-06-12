// @vitest-environment jsdom
/**
 * W4.1 Machine Room — rendered run-console component tests.
 *
 * Drives the console through a mocked `LiveRunEventClient` (same harness as the
 * W3.1 live boundary test) and asserts the showcase upgrade is wired to the
 * EXISTING SSE frames — no new fetch:
 *  - the heartbeat strip renders above the CRT log with a static "last signal Xs
 *    ago" fallback (informs even with motion off);
 *  - per-stage odometers count UP as successive delta frames raise `processed`;
 *  - the single completion ledger (B-P1-1) renders exactly ONCE on completion
 *    (the old stacked scorecard + next-actions blocks are gone, not duplicated).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import type { LiveRunStreamEvent } from "$lib/connect/live-run-events";

type Captured = {
  urlProvider?: () => string;
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

vi.mock("$app/navigation", () => ({
  invalidate: vi.fn(),
  goto: vi.fn(),
}));

import ConnectIngestRunConsole from "./ConnectIngestRunConsole.svelte";

const STATUS_BASE = "/keys/dashboard/api/connect/ingest/jobs/run-1/status";

function statusResponse(body: Record<string, unknown>) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

/** A running job with per-stage progress — the shape the SSE frames carry. */
function runningJob(extractedProcessed: number) {
  return {
    id: "run-1",
    status: "running",
    created_at: "2026-06-12T10:00:00.000Z",
    updated_at: new Date().toISOString(),
    worker_heartbeat_at: Date.now(),
    current_stage: "extracting",
    progress: { percent: 30, processed: extractedProcessed, total: 412, execution_mode: "full" },
    stages: [
      { stage: "extracting", status: "running", progress: { percent: 50, processed: extractedProcessed, total: 412 } },
      { stage: "validating", status: "pending" },
      { stage: "storing", status: "pending" },
    ],
  };
}

describe("ConnectIngestRunConsole Machine Room (W4.1)", () => {
  beforeEach(() => {
    captured = null;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the heartbeat strip with a static signal-age fallback while running", async () => {
    const fetchMock = vi.fn(async () =>
      statusResponse({
        job: runningJob(10),
        workspace_id: "ws-1",
        log_lines: ["[EXTRACT] starting"],
        log_line_total: 1,
        since: 1,
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { container } = render(ConnectIngestRunConsole, {
      props: { jobId: "run-1", statusApiBase: STATUS_BASE },
    });
    await tick();
    await vi.waitFor(() => expect(captured).not.toBeNull());
    await vi.waitFor(() =>
      expect(container.querySelector(".heartbeat-strip")).not.toBeNull(),
    );

    // The static fallback text always informs (reduced-motion branch relies on it).
    const label = container.querySelector(".heartbeat-label")?.textContent ?? "";
    expect(label.toLowerCase()).toContain("last worker signal");
    // The tick-line is present with the expected cell glyphs.
    const bar = container.querySelector(".heartbeat-bar")?.textContent ?? "";
    expect(bar).toMatch(/[▮▯]{5}/);
  });

  it("odometers count UP as successive delta frames raise processed", async () => {
    const fetchMock = vi.fn(async () =>
      statusResponse({
        job: runningJob(10),
        workspace_id: "ws-1",
        log_lines: [],
        log_line_total: 0,
        since: 0,
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { container } = render(ConnectIngestRunConsole, {
      props: { jobId: "run-1", statusApiBase: STATUS_BASE },
    });
    await tick();
    await vi.waitFor(() => expect(captured).not.toBeNull());
    await vi.waitFor(() =>
      expect(container.querySelector(".odometer")).not.toBeNull(),
    );

    function extractCount(): number {
      const first = container.querySelector(".odometer .odometer-value")?.textContent ?? "0";
      return Number(first.replace(/[^0-9]/g, ""));
    }
    expect(extractCount()).toBe(10);

    // A live delta raises the extract odometer to 367.
    captured!.onEvent({
      type: "delta",
      cursor: 2,
      job: runningJob(367) as never,
    });
    await tick();
    await vi.waitFor(() => expect(extractCount()).toBe(367));
    // Monotonic up — the odometer never went backwards.
    expect(extractCount()).toBeGreaterThan(10);
  });

  it("renders the completion ledger EXACTLY ONCE on completion (no duplicate blocks)", async () => {
    const fetchMock = vi.fn(async () =>
      statusResponse({
        job: {
          id: "run-1",
          status: "completed",
          created_at: "2026-06-12T10:00:00.000Z",
          updated_at: "2026-06-12T10:08:00.000Z",
          progress: {
            percent: 100,
            // CRITICAL-1: the TRUE persisted shape. `progress.processed` is the
            // completed-STAGE count (the reporter writes CONNECT_INGEST_PIPELINE_STAGES
            // .length = 7 here), NOT a unit count. The fixture previously faked 412 here,
            // masking that the cap was headlining the stage count as "units captured".
            processed: 7,
            total: 7,
            execution_mode: "full",
            quality_report: {
              ok_pct: 92,
              kg_audit: { trust_score: 88 },
              // The real captured unit count lives on the quality report (units), exactly
              // as `buildRunQualityReport` persists it. This — not processed — is the cap.
              units: 412,
            },
          },
        },
        workspace_id: "ws-1",
        log_lines: [],
        log_line_total: 0,
        since: 0,
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { container } = render(ConnectIngestRunConsole, {
      props: { jobId: "run-1", statusApiBase: STATUS_BASE },
    });
    await tick();
    await vi.waitFor(() => expect(captured).not.toBeNull());
    await vi.waitFor(() =>
      expect(container.querySelector(".completion-ledger")).not.toBeNull(),
    );

    // Exactly one ledger; the old stacked scorecard / next-actions blocks are gone.
    expect(container.querySelectorAll(".completion-ledger").length).toBe(1);
    expect(container.querySelectorAll(".ledger-cap").length).toBe(1);
    expect(container.querySelector(".run-quality-scorecard")).toBeNull();
    expect(container.querySelector(".run-next-actions")).toBeNull();

    // The verdict cap QUOTES the run's quality numbers (single-source).
    expect(container.querySelector(".ledger-cap-numeral")?.textContent).toBe("88");
    expect(container.querySelector(".ledger-cap-verdict")?.textContent).toContain("Strong");
    const stats = container.querySelector(".ledger-cap-stats")?.textContent ?? "";
    expect(stats).toContain("92% supported");
    // CRITICAL-1: the cap quotes the REAL unit count (412), never the completed-stage
    // count (7). "7 units" would be the bug — the stage tally headlined as units.
    expect(stats).toContain("412 units");
    expect(stats).not.toMatch(/\b7 units\b/);

    // Machine Room instrumentation is for in-progress runs — absent once complete.
    expect(container.querySelector(".heartbeat-strip")).toBeNull();
    expect(container.querySelector(".odometer")).toBeNull();
  });

  it("MAJOR-1: a plain full completed run renders the ledger ALONE — no .run-success banner", async () => {
    const fetchMock = vi.fn(async () =>
      statusResponse({
        job: {
          id: "run-1",
          status: "completed",
          created_at: "2026-06-12T10:00:00.000Z",
          updated_at: "2026-06-12T10:08:00.000Z",
          progress: {
            percent: 100,
            processed: 7,
            total: 7,
            execution_mode: "full",
            quality_report: {
              ok_pct: 92,
              kg_audit: { trust_score: 88 },
              units: 412,
            },
          },
        },
        workspace_id: "ws-1",
        log_lines: [],
        log_line_total: 0,
        since: 0,
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    // No graphTask / fromGraph → the default-case success banner used to stack here.
    const { container } = render(ConnectIngestRunConsole, {
      props: { jobId: "run-1", statusApiBase: STATUS_BASE },
    });
    await tick();
    await vi.waitFor(() => expect(captured).not.toBeNull());
    await vi.waitFor(() =>
      expect(container.querySelector(".completion-ledger")).not.toBeNull(),
    );

    // The default-case "Run complete" banner is DELETED (not hidden): absent entirely.
    expect(container.querySelector(".run-success")).toBeNull();
    // The single completion ledger is the only completion summary.
    expect(container.querySelectorAll(".completion-ledger").length).toBe(1);
  });

  it("MINOR-3: a completed run with no okPct shows honest '—' supported, not a red 0%", async () => {
    const fetchMock = vi.fn(async () =>
      statusResponse({
        job: {
          id: "run-1",
          status: "completed",
          created_at: "2026-06-12T10:00:00.000Z",
          updated_at: "2026-06-12T10:08:00.000Z",
          progress: {
            percent: 100,
            processed: 7,
            total: 7,
            execution_mode: "full",
            // No ok_pct, no units → both stats are honest absences.
            quality_report: { kg_audit: { trust_score: 88 } },
          },
        },
        workspace_id: "ws-1",
        log_lines: [],
        log_line_total: 0,
        since: 0,
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { container } = render(ConnectIngestRunConsole, {
      props: { jobId: "run-1", statusApiBase: STATUS_BASE },
    });
    await tick();
    await vi.waitFor(() => expect(captured).not.toBeNull());
    await vi.waitFor(() =>
      expect(container.querySelector(".completion-ledger")).not.toBeNull(),
    );

    const stats = container.querySelector(".ledger-cap-stats")?.textContent ?? "";
    // Honest absence: "— supported", never a fabricated "0% supported".
    expect(stats).toContain("— supported");
    expect(stats).not.toContain("0% supported");
    // The supported stat carries the muted (not red) tint.
    expect(container.querySelector(".ledger-cap-stat--muted")).not.toBeNull();
    expect(container.querySelector(".ledger-cap-stat--red")).toBeNull();
    // Units absent → the units stat is dropped entirely (no "— units captured").
    expect(stats).not.toContain("units captured");
  });
});
