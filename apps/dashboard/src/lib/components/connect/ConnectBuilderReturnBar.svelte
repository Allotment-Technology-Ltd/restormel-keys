<script lang="ts">
  import {
    returnContextBackLabel,
    returnContextFromLabel,
    returnContextHref,
    type BuilderReturnContext,
  } from "$lib/connect/pipeline-config";

  export let context: BuilderReturnContext;

  $: returnHref = returnContextHref(context);
  $: backLabel = returnContextBackLabel(context);
  $: fromLabel = returnContextFromLabel(context);
</script>

<nav class="builder-return-bar" aria-label="Return to previous page">
  <a class="builder-return-link" href={returnHref}>{backLabel}</a>
  <span class="builder-return-from">{fromLabel}</span>
</nav>

<style>
  .builder-return-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 40px;
    margin: 0 0 var(--space-4);
    padding: 0 var(--space-3);
    background: var(--color-bg);
    border-bottom: var(--border);
  }

  .builder-return-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    color: var(--color-ink);
    text-decoration: none;
  }

  .builder-return-link:hover {
    text-decoration: underline;
  }

  .builder-return-from {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    flex-shrink: 0;
  }
</style>
