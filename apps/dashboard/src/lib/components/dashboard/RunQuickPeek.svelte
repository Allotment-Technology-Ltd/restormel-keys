<script lang="ts">
  /**
   * RunQuickPeek — the DossierRail's first consumer (Stage R6, §3.2).
   *
   * Renders a run's quick-peek inside the shared DossierRail: status glyph + text
   * (never colour-only), progress, stall state (the W1.4 model), and right-aligned
   * links into the full run console and — for completed runs — the Claims review
   * desk where the W2.2 Evidence Dossier lives. This keeps the rail's first
   * consumer self-contained while pointing operators at the dossier surface; the
   * full W2.2 panel migrates *into* a rail of its own under W4.4 (see DossierRail).
   */
  import { RUNS_HREF, CLAIMS_HREF } from "$lib/nav-config";
  import {
    isLiveRunStalled,
    type LiveRunChipJob,
  } from "$lib/connect/live-run-chip";

  export let job: LiveRunChipJob & {
    current_stage?: string;
    updated_at?: string;
  };
  export let nowMs: number = Date.now();

  $: active = job.status === "pending" || job.status === "running";
  $: stalled = isLiveRunStalled(job, nowMs);
  $: percent = Math.max(0, Math.min(100, Math.round(job.progress?.percent ?? 0)));

  type StateGlyph = { glyph: string; label: string };
  function stateFor(status: string, isStalled: boolean): StateGlyph {
    if (isStalled) return { glyph: "▲", label: "Stalled" };
    if (status === "completed") return { glyph: "■", label: "Completed" };
    if (status === "failed") return { glyph: "▲", label: "Failed" };
    if (status === "cancelled") return { glyph: "□", label: "Cancelled" };
    if (status === "running") return { glyph: "■", label: "Running" };
    if (status === "pending") return { glyph: "□", label: "Pending" };
    return { glyph: "□", label: status };
  }
  $: state = stateFor(job.status, stalled);

  function relative(iso: string | undefined): string {
    if (!iso) return "—";
    const ms = nowMs - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "just now";
    if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
    return `${Math.round(ms / 3_600_000)}h ago`;
  }
</script>

<div class="peek">
  <p class="peek-state" class:peek-state-stalled={stalled}>
    <span class="peek-glyph" aria-hidden="true">{state.glyph}</span>
    <span class="peek-state-label">{state.label}</span>
  </p>

  <dl class="peek-rows">
    <div class="peek-row">
      <dt>Run</dt>
      <dd>{job.label ?? "Untitled run"}</dd>
    </div>
    {#if job.current_stage}
      <div class="peek-row">
        <dt>Stage</dt>
        <dd>{job.current_stage}</dd>
      </div>
    {/if}
    {#if active}
      <div class="peek-row">
        <dt>Progress</dt>
        <dd>{percent}%</dd>
      </div>
    {/if}
    <div class="peek-row">
      <dt>Started</dt>
      <dd>{relative(job.created_at)}</dd>
    </div>
    <div class="peek-row">
      <dt>Updated</dt>
      <dd>{relative(job.updated_at)}</dd>
    </div>
  </dl>

  {#if stalled}
    <p class="peek-note" role="status">
      No worker heartbeat for a while — this run may have stalled. Open the console to cancel or restart it.
    </p>
  {/if}

  <div class="peek-links">
    <a class="peek-link" href={`${RUNS_HREF}/${job.id}`}>Open run console →</a>
    {#if job.status === "completed"}
      <a class="peek-link" href={CLAIMS_HREF}>Review claims &amp; evidence dossier →</a>
    {/if}
  </div>
</div>

<style>
  .peek {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .peek-state {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: var(--text-sm);
    color: var(--brut-ink);
  }
  .peek-glyph {
    font-size: 1rem;
  }
  .peek-state-stalled {
    color: var(--brut-amber, #e6a700);
  }
  .peek-rows {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    border-top: var(--brut-border-micro) solid var(--brut-ink);
  }
  .peek-row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    align-items: baseline;
    min-height: 44px;
    padding: var(--space-2) 0;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
  }
  .peek-row dt {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-dim);
  }
  .peek-row dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--brut-ink);
    text-align: right;
    word-break: break-word;
  }
  .peek-note {
    margin: 0;
    padding: var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-amber, #e6a700);
    background: color-mix(in oklab, var(--brut-amber, #e6a700) 14%, var(--brut-white));
    font-size: var(--text-sm);
    color: var(--brut-ink);
  }
  .peek-links {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .peek-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-weight: 700;
    color: var(--brut-ink);
    text-decoration: none;
    border-bottom: var(--brut-border-micro) solid var(--brut-ink);
  }
  .peek-link:hover {
    background: var(--brut-neon);
    text-decoration: none;
  }
</style>
