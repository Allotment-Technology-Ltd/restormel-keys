<script lang="ts">
  /**
   * Phase 3 Stage 1 — the trust verdict for an answer (Grounded / Some uncertainty
   * / Insufficient evidence — abstained). Colour-coded with the brutalist state
   * tokens. The label and detail are derived from the retrieved claims
   * (deriveAnswerVerdict), so every word is backed — abstention is a designed,
   * first-class state, never an error.
   */
  import type { AnswerVerdictSummary } from "$lib/connect/graph-comparison-types";

  export let summary: AnswerVerdictSummary;
</script>

<div
  class="verdict verdict-{summary.verdict}"
  role="status"
  aria-label={`Answer verdict: ${summary.label}`}
>
  <span class="verdict-dot" aria-hidden="true"></span>
  <span class="verdict-label">{summary.label}</span>
  <span class="verdict-detail">{summary.detail}</span>
</div>

<style>
  .verdict {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: var(--border);
    box-shadow: var(--shadow-sm, var(--shadow-md));
  }

  .verdict-dot {
    width: 10px;
    height: 10px;
    border: var(--border-thin);
    align-self: center;
    flex-shrink: 0;
  }

  .verdict-label {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
  }

  .verdict-detail {
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.4;
    color: var(--color-ink-muted);
  }

  /* Grounded — source-bound, every claim verified. */
  .verdict-grounded {
    background: var(--state-ok-bg);
    color: var(--state-ok-fg);
  }
  .verdict-grounded .verdict-dot {
    background: var(--state-ok-fg);
  }

  /* Some uncertainty — claims retrieved but weaker/contested ones present. */
  .verdict-uncertain {
    background: var(--state-warn-bg);
    color: var(--state-warn-fg);
  }
  .verdict-uncertain .verdict-dot {
    background: var(--state-warn-fg);
  }

  /* Abstained — honest refusal; no verified claim matched. A designed state. */
  .verdict-abstained {
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
  }
  .verdict-abstained .verdict-dot {
    background: var(--state-fail-fg);
  }
</style>
