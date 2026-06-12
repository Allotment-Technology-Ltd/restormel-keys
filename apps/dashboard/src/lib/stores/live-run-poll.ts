/**
 * Live-run feed for the topbar chip (Stage R6 → W3.1 SSE swap point).
 *
 * Exposes the SAME contract it always has — `liveRunJobs` (a readable store of
 * the workspace's ingest jobs, `null` until first data) and `startLiveRunPoll()`
 * (idempotent, reference-counted, returns a stop fn). The chip and any other
 * consumer are untouched by the W3.1 transport change.
 *
 * W3.1 replaced the bare 30s fetch loop with the live SSE channel
 * (`/api/connect/ingest/events`) via `LiveRunEventClient`:
 *  - snapshots replace the whole job set; deltas patch a single run in place;
 *  - the client self-heals across the serverless stream-budget reconnects and,
 *    after repeated connect failures, calls back so we engage the original 30s
 *    poll as the documented fallback (no second live path — X8 poll diet);
 *  - polling/streaming both pause while the tab is hidden (the client binds its
 *    own visibility handler; the fallback poll keeps the R6 hidden-tab skip).
 *
 * The fallback poll IS the pre-W3.1 R6 behaviour, kept verbatim as the safety net.
 */
import { writable, type Readable } from "svelte/store";
import { browser } from "$app/environment";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import type { LiveRunChipJob } from "$lib/connect/live-run-chip";
import { LiveRunEventClient } from "$lib/connect/live-run-event-client";
import type { LiveRunEventJob, LiveRunStreamEvent } from "$lib/connect/live-run-events";

const JOBS_API = DASHBOARD_BASE + "/api/connect/ingest/jobs";
const EVENTS_API = DASHBOARD_BASE + "/api/connect/ingest/events";
const POLL_MS = 30_000;

const store = writable<LiveRunChipJob[] | null>(null);

let consumers = 0;
let client: LiveRunEventClient | null = null;

// Fallback-poll state (engaged only if SSE is judged unhealthy).
let fallbackActive = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let visibilityBound = false;

/** Patch one run into the current store value (delta), or append if new. */
function applyDelta(job: LiveRunEventJob): void {
  store.update((current) => {
    const list = current ?? [];
    const idx = list.findIndex((j) => j.id === job.id);
    if (idx === -1) return [job, ...list];
    const next = list.slice();
    next[idx] = { ...next[idx], ...job };
    return next;
  });
}

function onEvent(event: LiveRunStreamEvent): void {
  if (event.type === "snapshot") {
    store.set(event.jobs);
  } else if (event.type === "delta") {
    applyDelta(event.job);
  }
  // heartbeat: no store change (the chip recomputes elapsed from its own clock).
}

// ── Fallback poll (verbatim R6 behaviour) ────────────────────────────────────
async function pollOnce(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const res = await fetch(JOBS_API, { headers: { accept: "application/json" } });
    if (!res.ok) {
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
  timer = setTimeout(() => void tick(), POLL_MS);
}

async function tick(): Promise<void> {
  if (typeof document !== "undefined" && document.hidden) {
    schedule();
    return;
  }
  await pollOnce();
  if (consumers > 0 && fallbackActive) schedule();
}

function onFallbackVisibility(): void {
  if (typeof document === "undefined") return;
  if (!document.hidden && consumers > 0 && fallbackActive) void tick();
}

function startFallbackPoll(): void {
  if (fallbackActive) return;
  fallbackActive = true;
  if (typeof document !== "undefined" && !visibilityBound) {
    document.addEventListener("visibilitychange", onFallbackVisibility);
    visibilityBound = true;
  }
  void tick();
}

function stopFallbackPoll(): void {
  fallbackActive = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (visibilityBound && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onFallbackVisibility);
    visibilityBound = false;
  }
}

/** Start the live feed (idempotent / reference-counted). Returns a stop function. */
export function startLiveRunPoll(): () => void {
  if (!browser) return () => {};
  consumers += 1;
  if (consumers === 1) {
    client = new LiveRunEventClient({
      url: EVENTS_API,
      onEvent,
      onFallback: startFallbackPoll,
      onLive: stopFallbackPoll,
    });
    client.start();
  }
  return () => {
    consumers = Math.max(0, consumers - 1);
    if (consumers === 0) {
      if (client) {
        client.stop();
        client = null;
      }
      stopFallbackPoll();
      store.set(null);
    }
  };
}

/** Read-only stream of the workspace's ingest jobs (null until first read). */
export const liveRunJobs: Readable<LiveRunChipJob[] | null> = { subscribe: store.subscribe };
