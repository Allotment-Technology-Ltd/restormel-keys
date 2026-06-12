<script lang="ts">
  /**
   * W4.3 — the shared "Prove it" affordance.
   *
   * One component, one grep-able class (`PROVE_LINK_CLASS` = "prove-it"): the
   * neo-brutalist dotted-underline + trailing ↗ that says "this number opens its
   * receipt." Distinct from nav links (solid) and from action buttons. Users
   * learn within minutes that in Restormel every claim opens its evidence.
   *
   * Read-only by construction: a prove-it link is always an <a> to evidence — it
   * mutates nothing, so it is safe on every surface including the mobile and
   * as-of read-only tiers (W4.3 hard rule 5). Build the `href` with the helpers
   * in `lib/prove-it.ts` so the destination is always real (rubric X4).
   */
  import { PROVE_LINK_CLASS } from "$lib/prove-it";

  /** Destination — build with a `prove-it.ts` helper so it lands on real evidence. */
  export let href: string;
  /** Accessible label; defaults to the visible text + "— open the evidence". */
  export let label: string | null = null;
  /** Render the ↗ glyph (default true). Off for inline runs of text where the glyph crowds. */
  export let arrow = true;
  /** Optional extra class hook for surface-local sizing without losing the shared class. */
  let extraClass = "";
  export { extraClass as class };
</script>

<a
  class="{PROVE_LINK_CLASS} brut-focus {extraClass}"
  {href}
  aria-label={label ?? undefined}
  data-prove-it
>
  <slot />{#if arrow}<span class="prove-it-arrow" aria-hidden="true">↗</span>{/if}
</a>

<style>
  /* The shared `.prove-it` rule lives globally in brutalist-utilities.css so the
     affordance is identical whether rendered by this component or applied to a
     raw <a>. Only the component-local arrow spacing lives here. */
  .prove-it-arrow {
    margin-left: 0.2em;
    font-weight: 700;
  }
</style>
