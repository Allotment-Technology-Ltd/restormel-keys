<script lang="ts">
  import type { QualityDelta } from "$lib/connect/graph-comparison-types";

  export let delta: QualityDelta;

  const VERDICT_LABEL: Record<QualityDelta["verdict"], string> = {
    significant: "SIGNIFICANT DIFFERENCE",
    moderate: "MODERATE DIFFERENCE",
    minimal: "MINIMAL DIFFERENCE",
  };
</script>

<section class="delta delta-{delta.verdict}" aria-label="Quality delta analysis">
  <header class="delta-head">
    <span class="delta-tag">QUALITY DELTA</span>
    <span class="delta-verdict">{VERDICT_LABEL[delta.verdict]}</span>
  </header>

  <div class="delta-rows">
    <div class="delta-row">
      <span class="delta-label">ADDITIONAL SPECIFICITY</span>
      <span class="delta-value">{delta.additional_specificity}</span>
    </div>
    <div class="delta-row">
      <span class="delta-label">CONTRADICTIONS FOUND</span>
      <span class="delta-value">{delta.contradictions ?? "None detected"}</span>
    </div>
    <div class="delta-row">
      <span class="delta-label">HEDGING RESOLVED</span>
      <span class="delta-value">{delta.hedging_resolved ?? "None detected"}</span>
    </div>
  </div>

  <p class="delta-foot">
    Your answer drew on {delta.provenance_count}
    verified {delta.provenance_count === 1 ? "claim" : "claims"} from your sources; the raw answer drew
    on none.
  </p>

  {#if delta.verdict === "minimal"}
    <p class="delta-note">
      Close answers usually mean the model already knew this from training — your sources didn't add
      much here. Try a question only your sources could answer to see the difference.
    </p>
  {/if}
</section>

<style>
  .delta {
    background: var(--color-surface);
    border: var(--border);
    box-shadow: var(--shadow-md);
  }
  /* The panel literally weighs more when the difference is larger. */
  .delta-significant {
    border: 3px solid var(--color-yellow);
    box-shadow: var(--shadow-lg);
  }
  .delta-moderate {
    border: var(--border);
    box-shadow: var(--shadow-md);
  }
  .delta-minimal {
    border: var(--border-thin);
    box-shadow: var(--shadow-sm);
  }

  .delta-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    background: var(--color-ink);
  }

  .delta-tag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-yellow);
  }

  .delta-verdict {
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: 1;
    color: var(--color-surface);
  }

  .delta-rows {
    padding: var(--space-4) var(--space-5);
  }

  .delta-row {
    display: grid;
    grid-template-columns: minmax(10rem, 14rem) 1fr;
    gap: var(--space-4);
    align-items: baseline;
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-bg-deep);
  }
  .delta-row:last-child {
    border-bottom: 0;
  }

  .delta-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }

  .delta-value {
    font-family: var(--font-body);
    font-size: var(--text-body-md);
    line-height: 1.5;
    color: var(--color-ink);
  }

  .delta-foot {
    margin: 0;
    padding: 0 var(--space-5) var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    letter-spacing: var(--text-mono-tracking);
    color: var(--color-ink-faint);
  }

  .delta-note {
    margin: 0;
    padding: var(--space-3) var(--space-5);
    border-top: var(--border-thin);
    background: var(--color-bg);
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.5;
    color: var(--color-ink-muted);
  }

  @media (max-width: 640px) {
    .delta-row {
      grid-template-columns: 1fr;
      gap: var(--space-1);
    }
  }
</style>
