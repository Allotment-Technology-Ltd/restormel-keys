<script lang="ts">
  import type { SuggestedQuestion } from "$lib/connect/graph-comparison-types";

  export let questions: SuggestedQuestion[] = [];
  export let loading = false;
  export let failed = false;
  export let disabled = false;
  export let onSelect: (question: SuggestedQuestion) => void;
  /**
   * RES-113 PR-B (flag-gated: onboardingJourney). M0 "Explore" reskin of the label +
   * empty-state copy. Default false keeps the shipped suggestions byte-for-byte unchanged.
   */
  export let onboarding = false;

  const SKELETON_WIDTHS = ["62%", "44%", "78%"];
</script>

<div class="suggested">
  <p class="suggested-label">{onboarding ? "OR TRY ONE OF THESE" : "SUGGESTED QUESTIONS"}</p>

  {#if loading}
    <div class="chips" aria-hidden="true">
      {#each SKELETON_WIDTHS as width, i (i)}
        <span class="chip-skeleton skeleton" style="width: {width}"></span>
      {/each}
    </div>
  {:else if failed || questions.length === 0}
    <p class="suggested-fallback">
      {#if onboarding}
        Type anything the graph would know — or just ask in your own words and watch the citations
        come back.
      {:else}
        Type a question your sources would know the answer to and ask away.
      {/if}
    </p>
  {:else}
    <div class="chips">
      {#each questions as q (q.id)}
        <button
          type="button"
          class="chip brut-focus"
          {disabled}
          on:click={() => onSelect(q)}
        >
          {q.question}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .suggested {
    margin-top: var(--space-4);
  }

  .suggested-label {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    border: var(--border);
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.3;
    text-align: left;
    padding: 6px 12px;
    cursor: pointer;
    transition: var(--brut-transition);
  }
  .chip:hover:not(:disabled) {
    background: var(--color-bg-deep);
    box-shadow: var(--shadow-sm);
  }
  .chip:active:not(:disabled) {
    transform: translate(1px, 1px);
  }
  .chip:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .suggested-fallback {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
  }

  .chip-skeleton {
    display: inline-block;
    height: 30px;
    border: var(--border-thin);
  }

  .skeleton {
    background: linear-gradient(
      90deg,
      var(--color-bg-deep) 25%,
      color-mix(in oklab, var(--color-bg-deep) 85%, var(--color-surface)) 50%,
      var(--color-bg-deep) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
      background: var(--color-bg-deep);
    }
    .chip {
      transition: none;
    }
  }
</style>
