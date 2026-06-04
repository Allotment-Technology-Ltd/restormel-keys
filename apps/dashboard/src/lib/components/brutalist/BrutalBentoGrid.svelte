<script lang="ts">
  import type { Snippet } from "svelte";

  /** Columns at the widest breakpoint. Cells collapse to 1 column on narrow screens. */
  export let columns = 3;
  export let children: Snippet;
</script>

<div class="brutal-bento" style="--bento-cols: {columns}" role="list">
  {@render children()}
</div>

<style>
  .brutal-bento {
    display: grid;
    grid-template-columns: repeat(var(--bento-cols), 1fr);
    gap: 0;
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-ink);
  }

  @media (max-width: 900px) {
    .brutal-bento {
      grid-template-columns: 1fr;
    }
  }
</style>
