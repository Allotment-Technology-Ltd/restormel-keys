<script lang="ts">
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
</script>

<div class="graph-page-skeleton" aria-busy="true">
  <BrutalLoadingState message="Loading graph explorer — fetching ideas from your store" rows={6} />
  <div class="graph-page-skeleton-panels" aria-hidden="true">
    <div class="sk-panel sk-panel-wide"></div>
    <div class="sk-panel sk-panel-narrow"></div>
  </div>
</div>

<style>
  .graph-page-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-2) 0;
  }

  .graph-page-skeleton-panels {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: 2fr 1fr;
  }

  @media (max-width: 900px) {
    .graph-page-skeleton-panels {
      grid-template-columns: 1fr;
    }
  }

  .sk-panel {
    min-height: 14rem;
    border: var(--brut-border-width, 2px) solid var(--brut-ink, var(--color-ink));
    background: repeating-linear-gradient(
      -45deg,
      var(--brut-canvas, var(--rm-surface)),
      var(--brut-canvas, var(--rm-surface)) 8px,
      var(--brut-canvas-deep, var(--rm-surface-raised)) 8px,
      var(--brut-canvas-deep, var(--rm-surface-raised)) 16px
    );
  }
</style>
