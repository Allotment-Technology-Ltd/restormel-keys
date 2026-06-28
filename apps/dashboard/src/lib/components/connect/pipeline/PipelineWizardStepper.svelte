<script lang="ts">
  import {
    PIPELINE_WIZARD_STEPS,
    M1_BUILD_RUNGS,
    m1RungForWizardStep,
    m1CompletedRungsFromSteps,
    m1RungVisualState,
    type PipelineWizardStepId,
  } from "$lib/connect/pipeline-config";

  export let currentStep: PipelineWizardStepId;
  export let onNavigate: (id: PipelineWizardStepId) => void;
  /** Steps whose completion criteria are actually met (not just "before the current step"). */
  export let completedIds: PipelineWizardStepId[] = [];
  /** Whether steps after the first are reachable (mirrors the server's store-first gate). */
  export let navigable = false;
  /**
   * RES-113 PR-C: render the friendly four-rung M1 ladder (Sources · Configure ·
   * Running · Done) instead of the literal Provider→Sources→Domain→Review strip.
   * DEFAULT false — with the `onboardingJourney` flag OFF the existing stepper is
   * byte-for-byte unchanged. Presentational only; routing is untouched.
   */
  export let friendly = false;

  // Friendly ladder state, derived from the SAME real signals as the literal
  // strip — active rung from the current step, completed rungs from honest
  // per-step completion (never live position; see pipeline-config notes).
  $: friendlyActiveRung = m1RungForWizardStep(currentStep);
  $: friendlyCompletedRungs = m1CompletedRungsFromSteps(completedIds);

  function stepState(id: PipelineWizardStepId): "completed" | "active" | "upcoming" {
    if (id === currentStep) return "active";
    if (completedIds.includes(id)) return "completed";
    return "upcoming";
  }

  function stepClickable(id: PipelineWizardStepId, index: number): boolean {
    if (id === currentStep) return false;
    return index === 0 || navigable;
  }

  function connectorAfter(index: number): "solid" | "dashed" {
    const next = PIPELINE_WIZARD_STEPS[index + 1];
    if (!next) return "dashed";
    if (stepState(PIPELINE_WIZARD_STEPS[index].id) === "completed" && stepState(next.id) === "completed") {
      return "solid";
    }
    return "dashed";
  }
</script>

{#if friendly}
  <nav class="wizard-stepper wizard-stepper--friendly" aria-label="Build progress">
    <ol class="wizard-steps">
      {#each M1_BUILD_RUNGS as r, i (r.id)}
        {@const state = m1RungVisualState(r.id, {
          activeRung: friendlyActiveRung,
          completedRungs: friendlyCompletedRungs,
        })}
        {@const done = state === "completed"}
        {@const active = state === "active"}
        <li
          class="wizard-step"
          class:wizard-step-completed={done}
          class:wizard-step-active={active}
          class:wizard-step-upcoming={state === "upcoming"}
        >
          <span class="wizard-step-btn" aria-current={active ? "step" : undefined}>
            <span class="wizard-step-glyph" aria-hidden="true">{done ? "✓" : i + 1}</span>
            <span class="wizard-step-label">{r.label}</span>
          </span>
        </li>
        {#if i < M1_BUILD_RUNGS.length - 1}
          <li
            class="wizard-connector"
            class:wizard-connector-solid={done}
            class:wizard-connector-dashed={!done}
            aria-hidden="true"
          ></li>
        {/if}
      {/each}
    </ol>
  </nav>
{:else}
<nav class="wizard-stepper" aria-label="Pipeline setup progress">
  <ol class="wizard-steps">
    {#each PIPELINE_WIZARD_STEPS as s, i (s.id)}
      {@const state = stepState(s.id)}
      {@const done = state === "completed"}
      {@const active = state === "active"}
      <li
        class="wizard-step"
        class:wizard-step-completed={done}
        class:wizard-step-active={active}
        class:wizard-step-upcoming={state === "upcoming"}
      >
        {#if stepClickable(s.id, i)}
          <button
            type="button"
            class="wizard-step-btn"
            on:click={() => onNavigate(s.id)}
            aria-label={done ? `${s.label} — completed, go back to edit` : `Go to ${s.label}`}
          >
            <span class="wizard-step-glyph" aria-hidden="true">{done ? "✓" : i + 1}</span>
            <span class="wizard-step-label">{s.label}</span>
          </button>
        {:else}
          <span class="wizard-step-btn" aria-current={active ? "step" : undefined}>
            <span class="wizard-step-glyph" aria-hidden="true">{done ? "✓" : i + 1}</span>
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
{/if}
