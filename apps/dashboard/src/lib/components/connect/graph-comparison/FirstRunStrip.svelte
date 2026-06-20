<script lang="ts">
  /**
   * Phase 3 Stage 2 — first-run strip.
   *
   * On a brand-new workspace the Answer Console is already seeded with a demo graph
   * (Stage 0/1). This strip makes that obvious and immediately usable: one-tap a
   * curated question to land a verified, cited answer — including a deliberate
   * abstention question that shows off the differentiator (the graph confidently
   * declining when its evidence does not cover the question).
   *
   * It is non-blocking by design: a dismissible strip above the input, never a modal
   * tour. Dismiss it, or just ask your own question — the input stays fully usable.
   */
  type FirstRunQuestion = { type: "answerable" | "abstention"; question: string };

  export let questions: FirstRunQuestion[] = [];
  export let disabled = false;
  export let onRun: (question: string) => void;
  export let onDismiss: () => void;

  // Lead with one answerable + one abstention so both behaviours are one tap away.
  $: answerable = questions.filter((q) => q.type === "answerable");
  $: abstention = questions.filter((q) => q.type === "abstention");
  $: ordered = [...answerable, ...abstention];
</script>

<aside class="firstrun" aria-label="Try a question on the demo graph">
  <div class="firstrun-head">
    <span class="firstrun-tag">START HERE — TRY A QUESTION</span>
    <button
      type="button"
      class="firstrun-dismiss brut-focus"
      on:click={onDismiss}
      aria-label="Dismiss the suggested questions"
    >
      DISMISS ✕
    </button>
  </div>
  <p class="firstrun-lede">
    Tap any question to get a verified, cited answer right now — no setup needed. The last one
    is something the sources <strong>don't</strong> cover, so you'll see Restormel
    <strong>abstain</strong> rather than make something up. That refusal is the point.
  </p>
  <div class="firstrun-chips">
    {#each ordered as q (q.question)}
      <button
        type="button"
        class="firstrun-chip brut-pressable brut-focus"
        class:abstain={q.type === "abstention"}
        {disabled}
        on:click={() => onRun(q.question)}
      >
        {#if q.type === "abstention"}
          <span class="chip-flag" aria-hidden="true">ABSTAINS</span>
        {:else}
          <span class="chip-flag chip-flag-answer" aria-hidden="true">ANSWERS</span>
        {/if}
        <span class="chip-q">{q.question}</span>
      </button>
    {/each}
  </div>
</aside>

<style>
  .firstrun {
    border: var(--border);
    border-left-width: 6px;
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .firstrun-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .firstrun-tag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .firstrun-dismiss {
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }
  .firstrun-dismiss:hover {
    color: var(--color-ink);
  }

  .firstrun-lede {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.5;
    color: var(--color-ink-muted);
  }

  .firstrun-chips {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .firstrun-chip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    text-align: left;
    border: var(--border);
    background: var(--color-bg);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    min-height: 44px;
  }
  .firstrun-chip.abstain {
    border-style: dashed;
  }
  .firstrun-chip:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .chip-flag {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    padding: 2px 6px;
    border: var(--border-thin);
    background: var(--color-surface);
    color: var(--color-ink);
  }
  .chip-flag-answer {
    background: var(--color-yellow);
  }

  .chip-q {
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.4;
    color: var(--color-ink);
  }
</style>
