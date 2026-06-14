<script lang="ts">
  import ModelAdvisoryPanel from "$lib/components/connect/ModelAdvisoryPanel.svelte";
</script>

<svelte:head>
  <title>Model Advisory – Restormel</title>
</svelte:head>

<div class="model-advisory-page">
  <header class="page-header">
    <p class="page-breadcrumb">Connect</p>
    <h1 class="page-title">Model advisory</h1>
    <p class="page-desc">
      Ranked suitability of available models for each pipeline stage. Verdicts account for model
      type, regional jurisdiction constraints, and cost. Use the stage selector and region presets
      to narrow the list to your deployment context.
    </p>
  </header>

  <ModelAdvisoryPanel />
</div>

<style>
  .model-advisory-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .page-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .page-breadcrumb {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-ink-muted);
  }

  .page-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-display-metric);
    font-weight: 900;
    line-height: var(--text-display-line-height);
    letter-spacing: var(--text-display-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .page-desc {
    margin: 0;
    max-width: 48rem;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--color-ink-muted);
  }
</style>
