<script lang="ts">
  import {
    pipelineWizardHref,
    pipelineWizardStepLabel,
    type PipelineWizardStepId,
  } from "$lib/connect/pipeline-config";

  export let step: PipelineWizardStepId;

  $: returnHref = pipelineWizardHref(step);
  $: stepLabel = pipelineWizardStepLabel(step);
</script>

<div class="wizard-return" role="status">
  <a class="wizard-return-link" href={returnHref}>← Back to pipeline setup</a>
  <span class="wizard-return-meta">Step: {stepLabel}</span>
</div>

<style>
  .wizard-return {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin: 0 0 var(--space-4);
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro, 1px) solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: color-mix(in oklab, var(--rm-sage) 10%, var(--rm-surface));
  }
  .wizard-return-link {
    color: var(--rm-text);
    font-weight: 700;
    font-size: var(--text-sm);
    text-decoration: none;
  }
  .wizard-return-link:hover {
    text-decoration: underline;
  }
  .wizard-return-meta {
    color: var(--rm-muted);
    font-size: var(--text-xs);
  }
</style>
