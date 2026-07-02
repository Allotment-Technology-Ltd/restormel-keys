// @vitest-environment jsdom
/**
 * RES-113 PR-5 — flag-gated journey M1 run console (supersedes the PR-C reskin).
 *
 * With `onboardingJourney` OFF (the default) none of the journey DOM exists and
 * every honest operator hook (.heartbeat-strip / .completion-ledger) renders in
 * its original position, unchanged. With it ON, plain runs get ONE honest
 * per-stage tracker (shared stage vocabulary — copy pack §2.4), the
 * instrumentation collapses behind a single closed-by-default "Show details"
 * disclosure that auto-opens on failure/rate-limit, and completion renders
 * exactly one primary CTA with the Verify secondary as muted text ONLY when the
 * run flagged something (copy pack §2.5).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import type { LiveRunStreamEvent } from "$lib/connect/live-run-events";

type Captured = { onEvent: (e: LiveRunStreamEvent) => void };
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
vi.mock("$app/navigation", () => ({ invalidate: vi.fn(), goto: vi.fn() }));

import ConnectIngestRunConsole from "./ConnectIngestRunConsole.svelte";

const STATUS_BASE = "/keys/dashboard/api/connect/ingest/jobs/run-1/status";

function statusResponse(body: Record<string, unknown>) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function runningJob(stageStatus = "running") {
  return {
    id: "run-1",
    status: "running",
    created_at: "2026-06-12T10:00:00.000Z",
    updated_at: new Date().toISOString(),
    worker_heartbeat_at: Date.now(),
    current_stage: "extracting",
    progress: { percent: 30, processed: 10, total: 412, execution_mode: "full" },
    stages: [
      { stage: "extracting", status: stageStatus, progress: { percent: 50, processed: 10, total: 412 } },
      { stage: "storing", status: "pending" },
    ],
  };
}

function completedJob(quarantineCount = 0) {
  return {
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
        quarantine_count: quarantineCount,
      },
    },
  };
}

function failedJob() {
  return {
    id: "run-1",
    status: "failed",
    error: "boom: something engine-shaped went wrong",
    created_at: "2026-06-12T10:00:00.000Z",
    updated_at: "2026-06-12T10:08:00.000Z",
    current_stage: "embedding",
    progress: { percent: 60, processed: 4, total: 7, execution_mode: "full" },
    stages: [
      { stage: "extracting", status: "completed", progress: { percent: 100, processed: 412, total: 412 } },
      { stage: "embedding", status: "failed" },
    ],
  };
}

async function renderConsole(job: Record<string, unknown>, props: Record<string, unknown>) {
  const fetchMock = vi.fn(async () =>
    statusResponse({ job, workspace_id: "ws-1", log_lines: [], log_line_total: 0, since: 0 }),
  );
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  const out = render(ConnectIngestRunConsole, {
    props: { jobId: "run-1", statusApiBase: STATUS_BASE, ...props },
  });
  await tick();
  await vi.waitFor(() => expect(captured).not.toBeNull());
  return out;
}

describe("Run console — flag OFF (live, unchanged)", () => {
  beforeEach(() => (captured = null));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("running: operator console — no journey tracker, honest heartbeat strip in place", async () => {
    const { container } = await renderConsole(runningJob(), {});
    await vi.waitFor(() => expect(container.querySelector(".heartbeat-strip")).not.toBeNull());
    expect(container.querySelector(".journey-tracker")).toBeNull();
    expect(container.querySelector(".journey-details")).toBeNull();
    expect(container.querySelector(".m1-rate-limit")).toBeNull();
    // The heartbeat strip is NOT tucked inside any disclosure on this path.
    expect(container.querySelector("details .heartbeat-strip")).toBeNull();
  });

  it("completed: honest completion ledger renders, no journey Done panel", async () => {
    const { container } = await renderConsole(completedJob(), {});
    await vi.waitFor(() => expect(container.querySelector(".completion-ledger")).not.toBeNull());
    expect(container.querySelector(".journey-done")).toBeNull();
    expect(container.querySelector("details.journey-details")).toBeNull();
  });
});

describe("Run console — journey M1 (flag ON)", () => {
  beforeEach(() => (captured = null));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("running: ONE honest per-stage tracker in the shared stage vocabulary", async () => {
    const { container } = await renderConsole(runningJob(), { onboardingJourney: true });
    await vi.waitFor(() => expect(container.querySelector(".journey-tracker")).not.toBeNull());
    const text = container.querySelector(".journey-tracker")?.textContent ?? "";
    // Real stage named in copy-pack vocabulary, with real counted units.
    expect(text).toContain("Reading your documents");
    expect(text).toContain("10 of 412");
    // `storing` is unmapped in the pack — falls back, never leaks the key.
    expect(text).toContain("Getting ready");
    expect(text).not.toContain("storing");
    // Honesty footnote + background line (copy pack §2.4).
    expect(text).toContain("Progress here is real");
    expect(text).toContain("You can leave this page");
  });

  it("running: instrumentation collapses behind ONE closed-by-default Show details", async () => {
    const { container } = await renderConsole(runningJob(), { onboardingJourney: true });
    await vi.waitFor(() => expect(container.querySelector("details.journey-details")).not.toBeNull());
    const details = container.querySelector("details.journey-details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain("Show details");
    // Heartbeat strip / machine room / log all live INSIDE the one disclosure.
    expect(details.querySelector(".heartbeat-strip")).not.toBeNull();
    expect(details.querySelector(".log-screen")).not.toBeNull();
    // Nothing instrumentation-shaped leaks outside it.
    expect(container.querySelectorAll(".heartbeat-strip")).toHaveLength(1);
  });

  it("running: real backoff signal lights the amber banner AND auto-opens details", async () => {
    const job = runningJob("running");
    (job.stages[0] as Record<string, unknown>).backoff = {
      reason_code: "rate_limit",
      attempt: 2,
      delay_ms: 2000,
      at: "2026-06-28T10:00:00.000Z",
    };
    const { container } = await renderConsole(job, { onboardingJourney: true });
    await vi.waitFor(() => expect(container.querySelector(".m1-rate-limit")).not.toBeNull());
    expect(container.querySelector(".m1-rate-limit")?.textContent ?? "").toContain(
      "The AI provider asked us to slow down.",
    );
    const details = container.querySelector("details.journey-details") as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });

  it("running: no amber banner without a real throttle signal", async () => {
    const { container } = await renderConsole(runningJob("running"), { onboardingJourney: true });
    await vi.waitFor(() => expect(container.querySelector(".journey-tracker")).not.toBeNull());
    expect(container.querySelector(".m1-rate-limit")).toBeNull();
  });

  it("failed: copy-pack stage-failure banner with Retry run → as the one primary; details auto-open", async () => {
    const { container } = await renderConsole(failedJob(), { onboardingJourney: true });
    await vi.waitFor(() => expect(container.querySelector(".run-error-banner")).not.toBeNull());
    const banner = container.querySelector(".run-error-banner");
    expect(banner?.getAttribute("role")).toBe("alert");
    // Stage named in the shared vocabulary — the engineering key never leaks.
    expect(banner?.textContent).toContain("Making it searchable stopped partway");
    expect(banner?.textContent).toContain("Everything finished so far is saved.");
    // Raw error stays reachable for support.
    expect(banner?.textContent).toContain("boom: something engine-shaped went wrong");
    const primary = banner?.querySelector(".btn-primary");
    expect(primary?.textContent).toContain("Retry run →");
    const details = container.querySelector("details.journey-details") as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });

  it("completed: exactly one primary CTA to the ask; ledger tucked into details", async () => {
    const { container } = await renderConsole(completedJob(0), { onboardingJourney: true });
    await vi.waitFor(() => expect(container.querySelector(".journey-done")).not.toBeNull());
    expect(container.querySelector("h1")?.textContent).toBe("Your graph is built");
    const done = container.querySelector(".journey-done");
    expect(done?.textContent).toContain("We found 412 facts across your documents.");
    const cta = done?.querySelector("a.btn-primary") as HTMLAnchorElement | null;
    expect(cta?.textContent).toContain("Ask your first question →");
    expect(cta?.getAttribute("href")).toContain("#home-ask-input");
    // No Verify line when this run flagged nothing.
    expect(container.querySelector(".journey-verify-line")).toBeNull();
    // The honest ledger still exists — as depth behind the single disclosure.
    const details = container.querySelector("details.journey-details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector(".completion-ledger")).not.toBeNull();
    // One yellow primary OUTSIDE the closed disclosure.
    const primariesOutsideDetails = [...container.querySelectorAll(".btn-primary")].filter(
      (el) => !el.closest("details.journey-details"),
    );
    expect(primariesOutsideDetails).toHaveLength(1);
  });

  it("completed with flagged claims: the Verify secondary is muted text, no arrow, no button", async () => {
    const { container } = await renderConsole(completedJob(6), { onboardingJourney: true });
    await vi.waitFor(() => expect(container.querySelector(".journey-verify-line")).not.toBeNull());
    const line = container.querySelector(".journey-verify-line");
    expect(line?.textContent).toContain(
      "6 of the facts we found couldn't be fully matched to their sources.",
    );
    const link = line?.querySelector("a.journey-verify-link");
    expect(link?.textContent?.trim()).toBe("Review them in Verify");
    // Demotion (copy pack Appendix A-2): plain inline link — no arrow glyph, no btn styling.
    expect(line?.textContent).not.toContain("→");
    expect(line?.querySelector(".btn")).toBeNull();
  });

  it("graph-tool runs keep the operator console even with the flag ON", async () => {
    const { container } = await renderConsole(runningJob(), {
      onboardingJourney: true,
      fromGraph: true,
      graphTask: "revalidate",
    });
    await vi.waitFor(() => expect(container.querySelector(".run-head")).not.toBeNull());
    expect(container.querySelector(".journey-tracker")).toBeNull();
    expect(container.querySelector("details.journey-details")).toBeNull();
  });
});
