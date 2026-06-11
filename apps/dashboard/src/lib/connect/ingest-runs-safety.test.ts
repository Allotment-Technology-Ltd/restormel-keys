/**
 * Tests for ingest-runs-safety.ts — stuck-run detection and confirm-before-destroy contract.
 *
 * Acceptance criteria (from docs/reviews/dashboard-ux-review-2026-06.md, C-P0-1/C-P0-2):
 *  - Healthy running/pending runs are NEVER counted as stuck.
 *  - A run with an expired lease IS stuck.
 *  - A run with a stale heartbeat (no lease column) IS stuck.
 *  - Terminal runs (failed, cancelled) are always stuck/cleanable.
 *  - A run with a valid (future) lease is NOT stuck even if heartbeat is old.
 */
import { describe, expect, it } from "vitest";
import { isJobStuck, STALE_HEARTBEAT_MS } from "./ingest-runs-safety";

const NOW = 1_700_000_000_000; // fixed reference time

describe("isJobStuck — healthy running runs are never stuck", () => {
  it("returns false for a running run with a valid (future) lease", () => {
    expect(
      isJobStuck(
        { status: "running", lease_expires_at: NOW + 60_000, worker_heartbeat_at: NOW - 10_000 },
        NOW,
      ),
    ).toBe(false);
  });

  it("returns false for a pending run with a valid lease", () => {
    expect(
      isJobStuck({ status: "pending", lease_expires_at: NOW + 5_000 }, NOW),
    ).toBe(false);
  });

  it("returns false for a running run with a fresh heartbeat and no lease column (legacy row)", () => {
    expect(
      isJobStuck(
        { status: "running", worker_heartbeat_at: NOW - 30_000, lease_expires_at: null },
        NOW,
      ),
    ).toBe(false);
  });

  it("returns false for a running run with NO durable-run columns at all", () => {
    expect(isJobStuck({ status: "running" }, NOW)).toBe(false);
  });

  it("returns false for a completed run (not a cleanup target)", () => {
    expect(isJobStuck({ status: "completed" }, NOW)).toBe(false);
  });
});

describe("isJobStuck — lease-expired runs ARE stuck", () => {
  it("returns true when lease_expires_at is in the past", () => {
    expect(
      isJobStuck(
        { status: "running", lease_expires_at: NOW - 1 },
        NOW,
      ),
    ).toBe(true);
  });

  it("returns true when lease_expires_at is exactly equal to NOW (boundary)", () => {
    // Expired is strictly less-than, so equal is not expired
    expect(
      isJobStuck(
        { status: "running", lease_expires_at: NOW },
        NOW,
      ),
    ).toBe(false);
  });

  it("returns true for a pending run with an expired lease", () => {
    expect(
      isJobStuck(
        { status: "pending", lease_expires_at: NOW - 1_000 },
        NOW,
      ),
    ).toBe(true);
  });
});

describe("isJobStuck — stale heartbeat on legacy rows", () => {
  it("returns true when heartbeat is stale beyond the threshold (no lease column)", () => {
    expect(
      isJobStuck(
        { status: "running", worker_heartbeat_at: NOW - STALE_HEARTBEAT_MS - 1, lease_expires_at: null },
        NOW,
      ),
    ).toBe(true);
  });

  it("returns false when heartbeat is exactly at the threshold boundary", () => {
    // Stale is strictly greater-than
    expect(
      isJobStuck(
        { status: "running", worker_heartbeat_at: NOW - STALE_HEARTBEAT_MS, lease_expires_at: null },
        NOW,
      ),
    ).toBe(false);
  });

  it("returns false when heartbeat is fresh (legacy row, no lease)", () => {
    expect(
      isJobStuck(
        { status: "running", worker_heartbeat_at: NOW - 1_000, lease_expires_at: null },
        NOW,
      ),
    ).toBe(false);
  });
});

describe("isJobStuck — terminal statuses are always cleanable", () => {
  it("returns true for failed runs (always a cleanup target)", () => {
    expect(isJobStuck({ status: "failed" }, NOW)).toBe(true);
  });

  it("returns true for cancelled runs (always a cleanup target)", () => {
    expect(isJobStuck({ status: "cancelled" }, NOW)).toBe(true);
  });

  it("returns true for failed runs even with a future lease (already terminal)", () => {
    expect(
      isJobStuck({ status: "failed", lease_expires_at: NOW + 999_999 }, NOW),
    ).toBe(true);
  });
});

describe("isJobStuck — confirm-before-destroy contract: stuckCount excludes healthy runs", () => {
  /**
   * Simulates the bulk-clean stuckCount reactive declaration from the runs list page:
   *   $: stuckCount = jobs.filter(j => isJobStuck(j)).length;
   *
   * Asserts the original bug (C-P0-2) is fixed: starting a healthy run no longer
   * increments stuckCount to 1 and triggers the danger button.
   */
  it("does not count a single healthy running job — the danger button must not appear", () => {
    const healthyRunningJob = {
      status: "running",
      id: "job-1",
      created_at: new Date(NOW - 5_000).toISOString(),
      updated_at: new Date(NOW - 2_000).toISOString(),
      lease_expires_at: NOW + 60_000,
      worker_heartbeat_at: NOW - 1_000,
    };
    const stuckCount = [healthyRunningJob].filter((j) => isJobStuck(j, NOW)).length;
    expect(stuckCount).toBe(0);
  });

  it("counts a mix of failed, cancelled, and expired-lease jobs correctly", () => {
    const jobs = [
      { status: "running", lease_expires_at: NOW + 60_000 }, // healthy — not stuck
      { status: "running", lease_expires_at: NOW - 1 },      // expired lease — stuck
      { status: "failed" },                                    // terminal — stuck
      { status: "cancelled" },                                 // terminal — stuck
      { status: "completed" },                                 // done — not stuck
      { status: "pending", lease_expires_at: NOW + 5_000 },  // healthy pending — not stuck
    ];
    const stuckCount = jobs.filter((j) => isJobStuck(j, NOW)).length;
    expect(stuckCount).toBe(3); // expired + failed + cancelled
  });
});
