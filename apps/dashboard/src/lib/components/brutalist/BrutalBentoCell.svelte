<script lang="ts">
  import type { Snippet } from "svelte";

  type Fill = "canvas" | "white" | "blue" | "coral" | "neon";

  export let span = 1;
  export let full = false;
  export let fill: Fill = "canvas";
  export let label: string | undefined = undefined;
  export let children: Snippet;

  $: fillClass =
    fill === "blue"
      ? "brut-fill-blue"
      : fill === "coral"
        ? "brut-fill-coral"
        : fill === "neon"
          ? "brut-fill-neon"
          : fill === "white"
            ? "brut-fill-white"
            : "brut-fill-canvas";
</script>

<section
  class="brutal-bento-cell {fillClass}"
  class:bento-full={full}
  style="--cell-span: {span}"
  role="listitem"
  aria-label={label}
>
  {#if label}
    <h3 class="brutal-bento-label">{label}</h3>
  {/if}
  {@render children()}
</section>

<style>
  .brutal-bento-cell {
    grid-column: span var(--cell-span);
    padding: var(--space-4);
    border: var(--brut-border-micro) solid var(--brut-ink);
  }

  .bento-full {
    grid-column: 1 / -1;
  }

  .brutal-bento-label {
    margin: 0 0 var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
  }

  @media (max-width: 900px) {
    .brutal-bento-cell,
    .bento-full {
      grid-column: 1;
    }
  }
</style>
