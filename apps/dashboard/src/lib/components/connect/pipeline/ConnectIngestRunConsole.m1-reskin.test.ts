// @vitest-environment jsdom
/**
 * RES-113 PR-C — flag-gated friendly M1 run-console reskin.
 *
 * The reskin is ADDITIVE. With `onboardingJourney` OFF (the default) none of the
 * friendly DOM exists and every honest hook (.heartbeat-strip / .completion-ledger)
 * renders unchanged. With it ON, the friendly build ladder, the amber rate-limit
 * banner (only when a stage actually reports backoff), and the "ask your own data"
 * Done card render ALONGSIDE — never replacing — the honest instrumentation.
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

function completedJob() {
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
      quality_report: { ok_pct: 92, kg_audit: { trust_score: 88 }, units: 412 },
    },
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

  it("running: no friendly frame, honest heartbeat strip still renders", async () => {
    const { container } = await renderConsole(runningJob(), {});
    await vi.waitFor(() => expect(container.querySelector(".heartbeat-strip")).not.toBeNull());
    expect(container.querySelector(".m1-build-frame")).toBeNull();
    expect(container.querySelector(".m1-rate-limit")).toBeNull();
  });

  it("completed: no Done card, honest completion ledger still renders", async () => {
    const { container } = await renderConsole(completedJob(), {});
    await vi.waitFor(() => expect(container.querySelector(".completion-ledger")).not.toBeNull());
    expect(container.querySelector(".m1-done-ask")).toBeNull();
  });
});

describe("Run console — friendly M1 reskin (flag ON)", () => {
  beforeEach(() => (captured = null));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("running: friendly ladder renders ALONGSIDE the honest heartbeat strip", async () => {
    const { container } = await renderConsole(runningJob(), { onboardingJourney: true });
    await vi.waitFor(() => expect(container.querySelector(".m1-build-frame")).not.toBeNull());
    // Additive — the honest instrumentation is untouched.
    expect(container.querySelector(".heartbeat-strip")).not.toBeNull();
    // Four StateChips, one per rung; "running" is the active state mid-run.
    expect(container.querySelectorAll(".m1-build-ladder [data-testid='state-chip']").length).toBe(4);
    const running = container.querySelector(".m1-build-ladder [data-state='running']");
    expect(running?.textContent).toContain("Running");
  });

  it("running: amber rate-limit banner ONLY when a stage reports backoff", async () => {
    const clean = await renderConsole(runningJob("running"), { onboardingJourney: true });
    await vi.waitFor(() => expect(clean.container.querySelector(".m1-build-frame")).not.toBeNull());
    expect(clean.container.querySelector(".m1-rate-limit")).toBeNull();

    captured = null;
    vi.unstubAllGlobals();
    const limited = await renderConsole(runningJob("rate_limited"), { onboardingJourney: true });
    await vi.waitFor(() => expect(limited.container.querySelector(".m1-rate-limit")).not.toBeNull());
    expect(limited.container.querySelector(".m1-rate-limit")?.textContent ?? "").toMatch(
      /no action needed/i,
    );
  });

  it("completed: 'ask your own data' Done card renders with the ledger", async () => {
    const { container } = await renderConsole(completedJob(), { onboardingJourney: true });
    await vi.waitFor(() => expect(container.querySelector(".m1-done-ask")).not.toBeNull());
    // The honest ledger is still the completion summary — Done is additive.
    expect(container.querySelector(".completion-ledger")).not.toBeNull();
    const cta = container.querySelector(".m1-done-cta") as HTMLAnchorElement | null;
    expect(cta?.getAttribute("href")).toContain("/prove/proof");
    expect(container.querySelector(".m1-build-frame .m1-build-title")?.textContent).toContain(
      "ready",
    );
  });
});
