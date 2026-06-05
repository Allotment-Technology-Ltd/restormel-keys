<script lang="ts">
  import {
    pipelineWizardStepLabel,
    returnContextHref,
    type BuilderReturnContext,
  } from "$lib/connect/pipeline-config";

  export let context: Extract<BuilderReturnContext, { kind: "pipeline-setup" }>;

  $: returnHref = returnContextHref(context);
  $: stepLabel = pipelineWizardStepLabel(context.step);
</script>

<nav class="wizard-return" aria-label="Return to pipeline setup">
  <a class="wizard-return-link" href={returnHref}>← Back to pipeline setup</a>
  <span class="wizard-return-meta">Step: {stepLabel}</span>
</nav>

<style>
  .wizard-return {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    min-height: 40px;
    margin: 0 0 var(--space-4);
    padding: 0 var(--space-3);
    background: var(--color-bg);
    border-bottom: var(--border);
  }
  .wizard-return-link {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    color: var(--color-ink);
    text-decoration: none;
  }
  .wizard-return-link:hover {
    text-decoration: underline;
  }
  .wizard-return-meta {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
  }
</style>
