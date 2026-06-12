<script lang="ts">
  /** Test-only harness: renders DossierRail with a body snippet + an opener button. */
  import DossierRail from "./DossierRail.svelte";
  export let open = false;
</script>

<button type="button" data-testid="opener" on:click={() => (open = true)}>Open</button>
<DossierRail bind:open title="Test rail">
  {#snippet body()}
    <button type="button" data-testid="inner">Inner action</button>
  {/snippet}
</DossierRail>
