<script context="module" lang="ts">
  export type ReadinessRunStatus =
    | "draft"
    | "linking"
    | "linked"
    | "embedding"
    | "embedded"
    | "validating"
    | "complete"
    | "archived";

  export type ReadinessRunSummary = {
    id: string;
    label: string;
    sizeTarget: number;
    sizeActual: number | null;
    status: ReadinessRunStatus;
    qualitySummary: {
      ok: number;
      weak: number;
      unsupported: number;
      unvalidated: number;
      okPct?: number;
    } | null;
    updatedAt: number;
  };
</script>

<script lang="ts">
  import BrutalBadge from "$lib/components/brutalist/BrutalBadge.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import { createEventDispatcher } from "svelte";

  export let runs: ReadinessRunSummary[] = [];
  export let activeRunId: string | null = null;
  export let loading = false;
  export let creating = false;
  export let error: string | null = null;
  /** Default cohort size offered in the "new run" control. */
  export let defaultSize = 100;

  const dispatch = createEventDispatcher<{
    select: { runId: string | null };
    create: { size: number };
    archive: { runId: string };
  }>();

  let newSize = defaultSize;

  const STATUS_LABEL: Record<ReadinessRunSummary["status"], string> = {
    draft: "Cohort ready",
    linking: "Linking…",
    linked: "Linked",
    embedding: "Embedding…",
    embedded: "Embedded",
    validating: "Validating…",
    complete: "Complete",
    archived: "Archived",
  };

  function statusVariant(status: ReadinessRunSummary["status"]): "primary" | "secondary" {
    return status === "complete" ? "primary" : "secondary";
  }

  $: visibleRuns = runs.filter((r) => r.status !== "archived");
</script>

<section class="readiness-library" aria-label="Readiness runs">
  <header class="lib-head">
    <div>
      <p class="lib-kicker">Connect · readiness library</p>
      <h3 class="lib-title">Readiness runs</h3>
      <p class="lib-lede">
        Take a cohort — the next N unchecked ideas — through link → embed → validate as one
        named pass. Spot-check quality before committing the whole backlog.
      </p>
    </div>
  </header>

  {#if error}
    <BrutalErrorBanner title="Readiness runs" message={error} />
  {/if}

  <ul class="lib-list" role="list">
    <li class="lib-run" class:lib-run--active={activeRunId === null}>
      <button
        type="button"
        class="lib-run-select brut-focus"
        aria-pressed={activeRunId === null}
        on:click={() => dispatch("select", { runId: null })}
      >
        <div class="lib-run-main">
          <span class="lib-run-label">Whole workspace</span>
          <span class="lib-run-meta">Operate on the full backlog (default)</span>
        </div>
        <BrutalBadge variant={activeRunId === null ? "primary" : "secondary"} label="Global" />
      </button>
    </li>

    {#each visibleRuns as run (run.id)}
      <li class="lib-run" class:lib-run--active={activeRunId === run.id}>
        <button
          type="button"
          class="lib-run-select brut-focus"
          aria-pressed={activeRunId === run.id}
          on:click={() => dispatch("select", { runId: run.id })}
        >
          <div class="lib-run-main">
            <span class="lib-run-label">{run.label}</span>
            <span class="lib-run-meta">
              {(run.sizeActual ?? run.sizeTarget).toLocaleString()} ideas
              {#if run.qualitySummary && run.qualitySummary.okPct != null}
                · {run.qualitySummary.okPct}% supported
              {/if}
            </span>
          </div>
          <BrutalBadge variant={statusVariant(run.status)} label={STATUS_LABEL[run.status]} />
        </button>
        <button
          type="button"
          class="lib-run-archive brut-focus"
          aria-label="Archive {run.label}"
          on:click={() => dispatch("archive", { runId: run.id })}
        >
          ✕
        </button>
      </li>
    {/each}

    {#if visibleRuns.length === 0 && !loading}
      <li class="lib-empty">No runs yet — create one to take a cohort through the journey.</li>
    {/if}
  </ul>

  <div class="lib-new">
    <label class="lib-new-field" for="readiness-new-size">
      <span class="lib-new-label">Cohort size</span>
      <input
        id="readiness-new-size"
        class="lib-input brut-focus"
        type="number"
        min="1"
        max="100000"
        step="50"
        bind:value={newSize}
        disabled={creating}
      />
    </label>
    <button
      type="button"
      class="brutal-btn brutal-btn-primary brut-pressable brut-focus"
      disabled={creating || !(newSize > 0)}
      on:click={() => dispatch("create", { size: Math.floor(newSize) })}
    >
      {creating ? "Creating…" : `New run · next ${Math.floor(newSize || 0).toLocaleString()} ideas`}
    </button>
  </div>
</section>

<style>
  .readiness-library {
    margin: 0 0 var(--space-4);
    border: var(--border);
    border-radius: 0;
    background: var(--brut-white);
    box-shadow: var(--shadow-lg);
    padding: var(--space-4) var(--space-5) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .lib-kicker {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .lib-title {
    margin: 0 0 var(--space-1);
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
  }

  .lib-lede {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    max-width: 60ch;
    color: color-mix(in oklab, var(--color-ink) 80%, transparent);
  }

  .lib-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .lib-run {
    display: flex;
    align-items: stretch;
    gap: 0;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--color-bg);
  }

  .lib-run--active {
    background: var(--brut-neon, #e8ff47);
    box-shadow: var(--brut-shadow-sm);
  }

  .lib-run-select {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font: inherit;
    min-width: 0;
  }

  .lib-run-select:hover,
  .lib-run-select:focus-visible {
    background: color-mix(in oklab, var(--brut-neon, #e8ff47) 35%, var(--color-bg));
    outline: none;
  }

  .lib-run-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .lib-run-label {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .lib-run-meta {
    font-size: var(--text-xs);
    color: color-mix(in oklab, var(--color-ink) 65%, transparent);
  }

  .lib-run-archive {
    flex-shrink: 0;
    width: 2.5rem;
    border: none;
    border-left: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    cursor: pointer;
    font-size: var(--text-sm);
    line-height: 1;
  }

  .lib-run-archive:hover,
  .lib-run-archive:focus-visible {
    background: var(--brut-alert, #c45c26);
    color: var(--brut-white);
    outline: none;
  }

  .lib-empty {
    padding: var(--space-3);
    font-size: var(--text-sm);
    color: color-mix(in oklab, var(--color-ink) 60%, transparent);
    border: var(--brut-border-micro) dashed var(--brut-ink);
  }

  .lib-new {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: var(--brut-border-micro) dashed var(--brut-ink);
  }

  .lib-new-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .lib-new-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: color-mix(in oklab, var(--color-ink) 72%, transparent);
  }

  .lib-input {
    min-height: 44px;
    width: 8rem;
    padding: 0.5rem 0.75rem;
    font: inherit;
    font-size: var(--text-sm);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    border-radius: 0;
  }
</style>
