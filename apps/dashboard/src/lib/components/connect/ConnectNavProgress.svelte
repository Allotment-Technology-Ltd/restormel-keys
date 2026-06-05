<script lang="ts">
  /** Indeterminate top bar — immediate navigation feedback (NN/g looped indicator, 2–9s range). */
  export let active = false;
  export let label = "Loading page";
</script>

{#if active}
  <div class="connect-nav-progress" role="progressbar" aria-valuetext={label} aria-busy="true">
    <span class="connect-nav-progress-bar" aria-hidden="true"></span>
    <span class="visually-hidden">{label}</span>
  </div>
{/if}

<style>
  .connect-nav-progress {
    position: sticky;
    top: 0;
    z-index: 40;
    height: 3px;
    margin: calc(-1 * var(--space-2)) 0 var(--space-3);
    background: color-mix(in oklab, var(--rm-border) 60%, transparent);
    overflow: hidden;
  }

  .connect-nav-progress-bar {
    display: block;
    height: 100%;
    width: 35%;
    background: var(--rm-sage, var(--color-yellow));
    border-right: 2px solid var(--color-ink);
    animation: connect-nav-progress-slide 1.1s ease-in-out infinite;
  }

  @keyframes connect-nav-progress-slide {
    0% {
      transform: translateX(-120%);
    }
    100% {
      transform: translateX(320%);
    }
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .connect-nav-progress-bar {
      animation: none;
      width: 100%;
      opacity: 0.85;
    }
  }
</style>
