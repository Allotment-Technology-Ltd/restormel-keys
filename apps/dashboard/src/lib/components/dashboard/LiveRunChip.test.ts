// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import LiveRunChip from "./LiveRunChip.svelte";
import type { LiveRunChipJob } from "$lib/connect/live-run-chip";

/**
 * The chip is driven by a mocked status stream via the `jobs` prop (controlled
 * mode), so these assertions cover the three required states — active, stalled,
 * zero — without timers or network.
 */

const nowIso = () => new Date().toISOString();

function activeJob(overrides: Partial<LiveRunChipJob> = {}): LiveRunChipJob {
  return {
    id: "run-1",
    status: "running",
    label: "Nightly ingest",
    created_at: new Date(Date.now() - 161_000).toISOString(), // 2:41 ago
    updated_at: nowIso(),
    progress: { percent: 62 },
    worker_heartbeat_at: Date.now(), // fresh heartbeat → not stalled
    lease_expires_at: Date.now() + 60_000,
    ...overrides,
  };
}

describe("LiveRunChip", () => {
  it("renders a linked chip during an active run", () => {
    const { getByTestId } = render(LiveRunChip, { props: { jobs: [activeJob()] } });
    const chip = getByTestId("live-run-chip");
    expect(chip.getAttribute("href")).toBe("/keys/dashboard/runs/run-1?from=chip");
    expect(chip.textContent).toContain("INGEST");
    expect(chip.textContent).toContain("62%");
    // accessible name is informative, not just decorative
    expect(chip.getAttribute("aria-label")).toMatch(/Ingest running/);
  });

  it("renders nothing when there is no active run (zero state)", () => {
    const completed = activeJob({ status: "completed" });
    const { queryByTestId } = render(LiveRunChip, { props: { jobs: [completed] } });
    expect(queryByTestId("live-run-chip")).toBeNull();
  });

  it("renders nothing for an empty job list", () => {
    const { queryByTestId } = render(LiveRunChip, { props: { jobs: [] } });
    expect(queryByTestId("live-run-chip")).toBeNull();
  });

  it("shows the amber stalled state when the worker heartbeat has gone stale", () => {
    const stalled = activeJob({
      worker_heartbeat_at: Date.now() - 120_000, // > 90s → stalled
      lease_expires_at: null,
    });
    const { getByTestId } = render(LiveRunChip, { props: { jobs: [stalled] } });
    const chip = getByTestId("live-run-chip");
    expect(chip.className).toContain("live-run-chip-stalled");
    expect(chip.textContent).toContain("STALLED");
    expect(chip.getAttribute("aria-label")).toMatch(/stalled/i);
  });

  it("treats an expired lease as stalled", () => {
    const stalled = activeJob({
      worker_heartbeat_at: null,
      lease_expires_at: Date.now() - 1_000, // expired
    });
    const { getByTestId } = render(LiveRunChip, { props: { jobs: [stalled] } });
    expect(getByTestId("live-run-chip").className).toContain("live-run-chip-stalled");
  });

  it("tracks the most recently created run when several are active", () => {
    const older = activeJob({ id: "old", created_at: new Date(Date.now() - 600_000).toISOString() });
    const newer = activeJob({ id: "new", created_at: new Date(Date.now() - 10_000).toISOString() });
    const { getByTestId } = render(LiveRunChip, { props: { jobs: [older, newer] } });
    expect(getByTestId("live-run-chip").getAttribute("href")).toContain("/runs/new");
  });
});
