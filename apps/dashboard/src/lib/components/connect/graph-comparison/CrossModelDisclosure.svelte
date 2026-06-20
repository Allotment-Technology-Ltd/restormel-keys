<script lang="ts">
  /**
   * Phase 3 Stage 4 — cross-model disclosure on the verified answer.
   *
   * Ties routing to the verdict: shows WHICH family produced the answer and WHICH
   * family validated the graph's claims, and asserts "cross-family ✓" ONLY when the
   * two are known, different families (the differentiator). When either side is
   * unknown, it says so plainly rather than implying a cross-check that did not
   * happen (claims-integrity rule — only state what the data supports).
   *
   * Inputs are real:
   *  - `answerProvider` comes from the live stream's `model` event (the chat route
   *    that generated THIS answer).
   *  - `validationProvider` comes from the routing-strip snapshot (the applied
   *    validation-stage model). Validation only runs over verified claims, so we
   *    only frame it as "validated" when the answer actually carried claims.
   */
  import { deriveCrossModel } from "$lib/connect/model-family";

  /** Provider token of the model that produced the answer (from the stream). */
  export let answerProvider: string | null = null;
  /** Provider token of the applied validation-stage model (from the strip snapshot). */
  export let validationProvider: string | null = null;
  /** How many verified claims backed the answer — 0 means nothing was validated. */
  export let claimCount = 0;

  $: disclosure = deriveCrossModel(answerProvider, validationProvider);
  // Only frame validation as having happened when claims were actually retrieved.
  $: validated = claimCount > 0 && !!validationProvider;
</script>

{#if answerProvider}
  <div
    class="xmodel"
    class:cross={disclosure.verdict === "cross_family" && validated}
    aria-label="Model provenance for this answer"
  >
    <span class="xmodel-leg">
      <span class="xmodel-key">ANSWERED BY</span>
      <span class="xmodel-val">{disclosure.answerLabel ?? answerProvider}</span>
    </span>

    {#if validated}
      <span class="xmodel-sep" aria-hidden="true">·</span>
      <span class="xmodel-leg">
        <span class="xmodel-key">VALIDATED BY</span>
        <span class="xmodel-val">{disclosure.validationLabel ?? validationProvider}</span>
      </span>

      {#if disclosure.verdict === "cross_family"}
        <span class="xmodel-badge xmodel-badge-cross" title="The validator is a different model family than the answer model">
          CROSS-FAMILY ✓
        </span>
      {:else if disclosure.verdict === "same_family"}
        <span class="xmodel-badge xmodel-badge-same" title="Answer and validator are the same model family">
          SAME FAMILY
        </span>
      {/if}
    {:else if claimCount === 0}
      <span class="xmodel-sep" aria-hidden="true">·</span>
      <span class="xmodel-note">no verified claims to cross-validate</span>
    {:else}
      <span class="xmodel-sep" aria-hidden="true">·</span>
      <span class="xmodel-note">validator not set — apply a validation model to enable cross-checking</span>
    {/if}
  </div>
{/if}

<style>
  .xmodel {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
    background: var(--color-surface);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
  }
  /* When a real cross-family check held, lift it with the accent left rule. */
  .xmodel.cross {
    border-left: 6px solid var(--color-ink);
    background: var(--color-bg);
  }

  .xmodel-leg {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-1);
  }

  .xmodel-key {
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--color-ink-muted);
    text-transform: uppercase;
  }

  .xmodel-val {
    font-weight: 700;
    color: var(--color-ink);
  }

  .xmodel-sep {
    color: var(--color-ink-faint);
  }

  .xmodel-note {
    color: var(--color-ink-muted);
    font-style: italic;
  }

  .xmodel-badge {
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 1px 6px;
    border: var(--border-thin);
  }
  .xmodel-badge-cross {
    background: var(--color-yellow);
    color: var(--color-ink);
    border-color: var(--color-ink);
    box-shadow: 2px 2px 0 0 var(--color-ink);
  }
  .xmodel-badge-same {
    background: transparent;
    color: var(--color-ink-muted);
    border-color: var(--color-ink-muted);
    border-style: dashed;
  }
</style>
