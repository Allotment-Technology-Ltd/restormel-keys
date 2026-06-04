<script lang="ts">
  /** Loading state with optional skeleton rows (docs/ux-contracts.md state conventions). */
  export let message = "Loading…";
  export let rows = 0;
</script>

<div class="brutal-loading" role="status" aria-live="polite">
  <p class="brutal-loading-msg">
    <span class="brutal-loading-bar" aria-hidden="true"></span>
    {message}
  </p>
  {#if rows > 0}
    <div class="brutal-skeletons" aria-hidden="true">
      {#each Array(rows) as _, i (i)}
        <div class="brutal-skeleton-row"></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .brutal-loading {
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    padding: var(--space-4);
    box-shadow: var(--brut-shadow);
  }

  .brutal-loading-msg {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: var(--text-xs);
  }

  .brutal-loading-bar {
    display: inline-block;
    width: 1.5rem;
    height: 0.75rem;
    background: var(--brut-neon);
    border: var(--brut-border-micro) solid var(--brut-ink);
    animation: brutal-pulse 1s steps(2) infinite;
  }

  .brutal-skeletons {
    margin-top: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .brutal-skeleton-row {
    height: 1.25rem;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: repeating-linear-gradient(
      45deg,
      var(--brut-canvas),
      var(--brut-canvas) 6px,
      var(--brut-canvas-deep) 6px,
      var(--brut-canvas-deep) 12px
    );
  }

  @keyframes brutal-pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
    100% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .brutal-loading-bar {
      animation: none;
    }
  }
</style>
