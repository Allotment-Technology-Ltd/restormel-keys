<script lang="ts">
  /**
   * RES-113 PR-B — M0 "Explore" hero (flag-gated: onboardingJourney).
   *
   * Reskins the Answer Console's first-run framing into the handoff M0 hero
   * (03_SCREENS.md → "Ask the starter graph"): the first aha, zero setup, ask a
   * seeded demo knowledge base and get a grounded answer whose citations you can
   * click straight to the source. Once the user ingests their own sources the demo
   * collapses away and the same hero reframes to "ask YOUR graph" (REC-ADR-021 M0:
   * "M0 collapses into 'ask your graph' once ingested").
   *
   * Presentational + copy only. It never owns the ask flow — it sits above the
   * existing console (GraphComparisonPanel) and the unchanged components do the work.
   * The milestone vocabulary is single-sourced from the PR-F helper (MILESTONE_LABEL)
   * so the "where am I / what next" cue can never drift from the journey model.
   */
  import StateChip from "$lib/components/brutalist/StateChip.svelte";
  import { MILESTONE_LABEL } from "$lib/connect/connect-journey";

  /** True while the console answers over the seeded demo graph (pre-ingest exploration). */
  export let isDemo = false;
  /** True once the first demo answer has streamed — strengthens the "now ingest" nudge. */
  export let hasAnswer = false;
  /** Where "Ingest your docs" goes (the M1 Build on-ramp). */
  export let ingestHref: string;

  // Two phases off one hero: pre-ingest "explore the starter graph" vs post-ingest
  // "ask your own graph". Derived purely from whether this is still the demo graph.
  $: phase = isDemo ? "explore" : "yours";
</script>

<section
  class="m0-hero"
  class:m0-hero-yours={phase === "yours"}
  aria-label={phase === "explore" ? "Explore the starter graph" : "Ask your graph"}
>
  <div class="m0-head">
    {#if phase === "explore"}
      <StateChip state="idle" label={`M0 · ${MILESTONE_LABEL.m0}`} dot={false} />
      <span class="m0-eyebrow">THE AHA — ZERO SETUP</span>
    {:else}
      <StateChip state="done" label={`M0 · ${MILESTONE_LABEL.m0}`} dot={false} />
      <span class="m0-eyebrow">YOUR OWN GRAPH — LIVE</span>
    {/if}
  </div>

  {#if phase === "explore"}
    <h1 class="m0-title">Ask the starter graph</h1>
    <p class="m0-lede">
      This is a small demo knowledge base we built for you — already ingested, nothing to set up.
      Ask it anything below and you'll get a grounded answer with <strong>citations you can click
      straight to the source</strong>. That's the whole idea: every answer stays bound to where it
      came from.
    </p>
  {:else}
    <h1 class="m0-title">Ask your graph</h1>
    <p class="m0-lede">
      You're past the demo — this is <strong>your own knowledge graph</strong> now. Ask it anything
      and every answer comes back bound to your sources, each citation clickable to the exact quote.
    </p>
  {/if}

  {#if phase === "explore"}
    <div class="m0-next" class:m0-next-strong={hasAnswer}>
      <span class="m0-next-label">
        {#if hasAnswer}
          That answer came with citations. Now point it at your own docs.
        {:else}
          Next, when you're ready: build the same thing over your own sources.
        {/if}
      </span>
      <a class="m0-next-cta brut-pressable brut-focus" href={ingestHref}>
        Ingest your docs → {MILESTONE_LABEL.m1}
      </a>
    </div>
  {/if}
</section>

<style>
  .m0-hero {
    border: var(--border);
    border-left-width: 6px;
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .m0-hero-yours {
    border-left-color: var(--state-ok-fg);
  }

  .m0-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .m0-eyebrow {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }

  .m0-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-display-md);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: var(--text-display-line-height);
    color: var(--color-ink);
  }

  .m0-lede {
    margin: 0;
    max-width: 46rem;
    font-family: var(--font-body);
    font-size: var(--text-body-md);
    line-height: 1.6;
    color: var(--color-ink-muted);
  }

  .m0-next {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-top: var(--space-1);
    padding-top: var(--space-3);
    border-top: var(--border-thin);
  }
  .m0-next-strong {
    border-top: var(--border);
  }

  .m0-next-label {
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
  }
  .m0-next-strong .m0-next-label {
    color: var(--color-ink);
    font-weight: 600;
  }

  .m0-next-cta {
    flex-shrink: 0;
    display: inline-block;
    padding: var(--space-2) var(--space-4);
    border: var(--border);
    border-radius: 0;
    background: var(--color-yellow);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    text-decoration: none;
  }

  @media (max-width: 640px) {
    .m0-next-cta {
      align-self: stretch;
      text-align: center;
    }
  }
</style>
