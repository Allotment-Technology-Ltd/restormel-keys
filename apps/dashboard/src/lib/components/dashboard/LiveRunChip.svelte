<script lang="ts">
  /**
   * Topbar live-run chip (Stage R6, §3.2).
   *
   * Renders `● INGEST 62% · 2:41` whenever an ingest run is active in the
   * workspace, linking to /runs/[id]. Pulses while live (static under
   * prefers-reduced-motion), turns amber on stall (the W1.4 staleness model,
   * promoted to the chrome). Absent at zero — it never renders an empty shell,
   * so it can't block topbar a11y.
   *
   * Two ways to feed it:
   *  - default: subscribes to the shared 30s workspace poll (`startLiveRunPoll`),
   *    which issues ONE workspace-scoped query (poll diet).
   *  - test/SSR: pass `jobs` directly (a mocked status stream) to bypass the poll.
   */
  import { onDestroy, onMount } from "svelte";
  import { RUNS_HREF } from "$lib/nav-config";
  import {
    deriveLiveRunChip,
    type LiveRunChipJob,
  } from "$lib/connect/live-run-chip";
  import { liveRunJobs, startLiveRunPoll } from "$lib/stores/live-run-poll";

  /**
   * When provided, the chip derives from these jobs and does NOT start the poll
   * (used by the component test and any caller that already has the stream).
   */
  export let jobs: LiveRunChipJob[] | null | undefined = undefined;

  const controlled = jobs !== undefined;

  let polled: LiveRunChipJob[] | null = null;
  let stopPoll: (() => void) | null = null;
  let unsub: (() => void) | null = null;

  // A 1s clock so the elapsed time ticks between polls.
  let nowMs = Date.now();
  let clock: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    if (!controlled) {
      stopPoll = startLiveRunPoll();
      unsub = liveRunJobs.subscribe((v) => (polled = v));
    }
    clock = setInterval(() => (nowMs = Date.now()), 1000);
  });

  onDestroy(() => {
    unsub?.();
    stopPoll?.();
    if (clock) clearInterval(clock);
  });

  $: source = controlled ? (jobs ?? null) : polled;
  $: chip = deriveLiveRunChip(source, nowMs);
</script>

{#if chip}
  <a
    class="live-run-chip"
    class:live-run-chip-stalled={chip.stalled}
    href={`${RUNS_HREF}/${chip.runId}?from=chip`}
    aria-label={chip.stalled
      ? `Ingest run stalled at ${chip.percent}% after ${chip.elapsed}${chip.label ? ` — ${chip.label}` : ""}. Open the run console.`
      : `Ingest running, ${chip.percent}% after ${chip.elapsed}${chip.label ? ` — ${chip.label}` : ""}. Open the run console.`}
    data-testid="live-run-chip"
  >
    <span class="live-run-dot" aria-hidden="true"></span>
    <span class="live-run-text">
      {#if chip.stalled}STALLED{:else}INGEST{/if}
      {chip.percent}% · {chip.elapsed}
    </span>
  </a>
{/if}

<style>
  .live-run-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
    padding: var(--space-1) var(--space-3);
    /* W4.5 a11y: ≥44px touch target (X10, #285) — was 36px. inline-flex already
       centres the content, so this only grows the tappable box. */
    min-height: 44px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .live-run-chip:hover {
    background: var(--brut-neon);
    color: var(--brut-ink);
    text-decoration: none;
  }
  .live-run-chip:focus-visible {
    outline: 2px solid var(--brut-ink);
    outline-offset: 2px;
  }
  .live-run-chip-stalled {
    background: color-mix(in oklab, var(--brut-amber) 16%, var(--brut-white));
    border-color: var(--brut-amber);
  }
  .live-run-chip-stalled:hover {
    background: color-mix(in oklab, var(--brut-amber) 28%, var(--brut-white));
  }
  .live-run-dot {
    width: 0.55rem;
    height: 0.55rem;
    background: var(--brut-ink);
    border-radius: 999px;
    flex: 0 0 auto;
    animation: live-run-pulse 1.4s ease-in-out infinite;
  }
  .live-run-chip-stalled .live-run-dot {
    background: var(--brut-amber);
    /* Stall is steady, not pulsing — amber + "STALLED" carry the meaning. */
    animation: none;
  }
  @keyframes live-run-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.25;
    }
  }
  /* Reduced-motion: hold the dot solid — colour + text still convey state. */
  @media (prefers-reduced-motion: reduce) {
    .live-run-dot {
      animation: none;
    }
  }
</style>
