// @vitest-environment jsdom
/**
 * RES-113 PR-8 — the ONE per-run economics line inside the run console's
 * existing "Show details" disclosure (placement spec §5 item 9; copy pack §2.8).
 *
 * Pins:
 *  - flag OFF (`m1PlugPoints` default): NO economics DOM exists, even when the
 *    job carries recorded measurements — the console renders byte-for-byte
 *    unchanged (the flag-OFF invariant);
 *  - flag ON + recorded economics: exactly ONE line, VERBATIM per the §2.8
 *    template, placed INSIDE the journey "Show details" disclosure — never
 *    outside it, never on the operator console;
 *  - flag ON + no recorded economics: no line at all (honest absence — a run
 *    with no recorded economics renders no summary line, never zeros).
 *
 * Query convention: the line is non-interactive chrome with no role/name
 * contract, so `.journey-economics-line` placement is asserted by class per the
 * a11y-skill testing note (the placement IS the contract under test).
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

const ECON_LINE =
  "Checked 1,204 facts · 302 re-used from earlier builds · 41 sent for a closer look · 7 awaiting your review · $1.42 spent.";

function statusResponse(body: Record<string, unknown>) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function completedJob(withEconomics: boolean) {
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
        quarantine_count: 0,
        ...(withEconomics
          ? {
              verification_economics: [
                {
                  corpus: "Contracts",
                  facts_checked: 1204,
                  reused_from_earlier_builds: 302,
                  sent_for_closer_look: 41,
                  awaiting_review: 7,
                  spend_usd: 1.42,
                },
              ],
            }
          : {}),
      },
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

describe("run console §2.8 economics line — flag OFF (byte-identical)", () => {
  beforeEach(() => (captured = null));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders NO economics DOM even when the run recorded measurements", async () => {
    const { container } = await renderConsole(completedJob(true), { onboardingJourney: true });
    await vi.waitFor(() => expect(container.querySelector(".journey-done")).not.toBeNull());
    expect(container.querySelector(".journey-economics-line")).toBeNull();
    expect(container.textContent).not.toContain("re-used from earlier builds");
    expect(container.textContent).not.toContain("spent.");
  });

  it("operator console (journey flag OFF too): no economics DOM anywhere", async () => {
    const { container } = await renderConsole(completedJob(true), { m1PlugPoints: true });
    await vi.waitFor(() => expect(container.querySelector(".completion-ledger")).not.toBeNull());
    // The line is a journey-details tenant only — the operator console never
    // renders it, m1PlugPoints or not (§2.8: ONE render surface per host).
    expect(container.querySelector(".journey-economics-line")).toBeNull();
  });
});

describe("run console §2.8 economics line — flag ON", () => {
  beforeEach(() => (captured = null));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the VERBATIM §2.8 line inside the Show details disclosure only", async () => {
    const { container } = await renderConsole(completedJob(true), {
      onboardingJourney: true,
      m1PlugPoints: true,
    });
    await vi.waitFor(() =>
      expect(container.querySelector(".journey-economics-line")).not.toBeNull(),
    );
    const lines = container.querySelectorAll(".journey-economics-line");
    expect(lines.length).toBe(1);
    expect(lines[0]!.textContent).toBe(ECON_LINE);
    // Inside the single "Show details" disclosure — zero pixels outside it.
    expect(container.querySelector("details.journey-details .journey-economics-line")).not.toBeNull();
  });

  it("a run with no recorded economics renders no line at all (never zeros)", async () => {
    const { container } = await renderConsole(completedJob(false), {
      onboardingJourney: true,
      m1PlugPoints: true,
    });
    await vi.waitFor(() => expect(container.querySelector(".journey-done")).not.toBeNull());
    expect(container.querySelector(".journey-economics-line")).toBeNull();
    expect(container.textContent).not.toContain("Checked 0 facts");
  });
});
