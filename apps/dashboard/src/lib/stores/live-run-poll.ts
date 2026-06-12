/**
 * Live-run poll (Stage R6) — ONE workspace-scoped query every 30s.
 *
 * Feeds the topbar live-run chip. W3.1 (SSE) is NOT merged, so the chip falls
 * back to a light poll within PR #259's poll diet: a single GET of
 * `/api/connect/ingest/jobs` (already workspace-scoped by session auth — no
 * UUIDs, no params), no duplicated stats/scorecard fetches.
 *
 * Discipline that keeps it cheap:
 *  - 30s cadence (vs the run console's 2.5s) — coarse on purpose; the chip is
 *    ambient awareness, not the console.
 *  - Polling pauses entirely while the tab is hidden (the same lever the run
 *    console uses to avoid a background-tab compute multiplier).
 *  - Reference-counted start/stop so mounting the chip in the layout starts at
 *    most one interval regardless of re-renders.
 *
 * When W3.1's SSE lands, this module is the single swap point: replace the
 * fetch loop with the event subscription and keep the same store contract.
 */
import { writable, type Readable } from "svelte/store";
import { browser } from "$app/environment";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import type { LiveRunChipJob } from "$lib/connect/live-run-chip";

const JOBS_API = DASHBOARD_BASE + "/api/connect/ingest/jobs";
const POLL_MS = 30_000;

const store = writable<LiveRunChipJob[] | null>(null);

let timer: ReturnType<typeof setTimeout> | null = null;
let consumers = 0;
let inFlight = false;
let visibilityBound = false;

async function pollOnce(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const res = await fetch(JOBS_API, { headers: { accept: "application/json" } });
    if (!res.ok) {
      // 401 (signed out) / 5xx: surface "no active run" rather than a stuck chip.
      store.set(res.status === 401 ? [] : null);
      return;
    }
    const data = (await res.json()) as { jobs?: LiveRunChipJob[] };
    store.set(Array.isArray(data.jobs) ? data.jobs : []);
  } catch {
    // Network blip: leave the last-known value in place (don't flap the chip).
  } finally {
    inFlight = false;
  }
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void tick();
  }, POLL_MS);
}

async function tick(): Promise<void> {
  if (typeof document !== "undefined" && document.hidden) {
    // Skip the round-trip while hidden; reschedule so we resume on the next tick
    // (visibilitychange also catches us up immediately on return).
    schedule();
    return;
  }
  await pollOnce();
  if (consumers > 0) schedule();
}

function onVisibilityChange(): void {
  if (typeof document === "undefined") return;
  if (!document.hidden && consumers > 0) {
    void tick();
  }
}

/** Start the poll (idempotent / reference-counted). Returns a stop function. */
export function startLiveRunPoll(): () => void {
  if (!browser) return () => {};
  consumers += 1;
  if (consumers === 1) {
    if (!visibilityBound) {
      document.addEventListener("visibilitychange", onVisibilityChange);
      visibilityBound = true;
    }
    void tick(); // immediate first read so the chip appears without a 30s wait
  }
  return () => {
    consumers = Math.max(0, consumers - 1);
    if (consumers === 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (visibilityBound) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        visibilityBound = false;
      }
      store.set(null);
    }
  };
}

/** Read-only stream of the workspace's ingest jobs (null until first read). */
export const liveRunJobs: Readable<LiveRunChipJob[] | null> = { subscribe: store.subscribe };
