<script lang="ts">
  import {
    PIPELINE_WIZARD_STEPS,
    type PipelineWizardStepId,
  } from "$lib/connect/pipeline-config";

  export let currentStep: PipelineWizardStepId;
  export let onNavigate: (id: PipelineWizardStepId) => void;

  $: stepIndex = PIPELINE_WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  function stepState(id: PipelineWizardStepId, index: number): "completed" | "active" | "upcoming" {
    if (id === currentStep) return "active";
    if (index < stepIndex) return "completed";
    return "upcoming";
  }

  function connectorAfter(index: number): "solid" | "dashed" {
    const curState = stepState(PIPELINE_WIZARD_STEPS[index].id, index);
    const next = PIPELINE_WIZARD_STEPS[index + 1];
    if (!next) return "dashed";
    const nextState = stepState(next.id, index + 1);
    if (curState === "completed" && nextState === "completed") return "solid";
    return "dashed";
  }
</script>

<nav class="wizard-stepper" aria-label="Pipeline setup progress">
  <ol class="wizard-steps">
    {#each PIPELINE_WIZARD_STEPS as s, i (s.id)}
      {@const state = stepState(s.id, i)}
      {@const done = state === "completed"}
      {@const active = state === "active"}
      <li
        class="wizard-step"
        class:wizard-step-completed={done}
        class:wizard-step-active={active}
        class:wizard-step-upcoming={state === "upcoming"}
      >
        {#if done}
          <button
            type="button"
            class="wizard-step-btn"
            on:click={() => onNavigate(s.id)}
            aria-label="{s.label} — completed, go back to edit"
          >
            <span class="wizard-step-glyph" aria-hidden="true">✓</span>
            <span class="wizard-step-label">{s.label}</span>
          </button>
        {:else}
          <span class="wizard-step-btn" aria-current={active ? "step" : undefined}>
            <span class="wizard-step-glyph" aria-hidden="true">{i + 1}</span>
            <span class="wizard-step-label">{s.label}</span>
          </span>
        {/if}
      </li>
      {#if i < PIPELINE_WIZARD_STEPS.length - 1}
        <li
          class="wizard-connector"
          class:wizard-connector-solid={connectorAfter(i) === "solid"}
          class:wizard-connector-dashed={connectorAfter(i) === "dashed"}
          aria-hidden="true"
        ></li>
      {/if}
    {/each}
  </ol>
</nav>
