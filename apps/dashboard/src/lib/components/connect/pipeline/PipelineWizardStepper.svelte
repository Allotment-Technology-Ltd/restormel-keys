<script lang="ts">
  import { PIPELINE_WIZARD_STEPS, type PipelineWizardStepId } from "$lib/connect/pipeline-config";

  export let currentStep: PipelineWizardStepId;
  export let onNavigate: (id: PipelineWizardStepId) => void;
  /** Steps whose completion criteria are actually met (not just "before the current step"). */
  export let completedIds: PipelineWizardStepId[] = [];
  /** Whether steps after the first are reachable (mirrors the server's store-first gate). */
  export let navigable = false;

  // RES-113 PR-5: the PR-C `friendly` four-rung ladder branch is DELETED, not
  // hidden — the flag-ON Build path renders no stepper at all (plan §3.2: one
  // state-derived panel with a non-interactive "STEP N OF 4" eyebrow instead).
  // This component now mounts only on the flag-OFF path, byte-for-byte unchanged.

  function stepState(id: PipelineWizardStepId): "completed" | "active" | "upcoming" {
    if (id === currentStep) return "active";
    if (completedIds.includes(id)) return "completed";
    return "upcoming";
  }

  function stepClickable(id: PipelineWizardStepId, index: number): boolean {
    if (id === currentStep) return false;
    return index === 0 || navigable;
  }

  /**
   * RES-122: the connector lives INSIDE the step `<li>` it leads INTO (not as a
   * separate `<li>` sibling between two steps). `.wizard-steps` wraps at narrow
   * widths (real dashboard content column is ~640-892px, well under this 4-step
   * strip's natural width) — with the connector as its own flex sibling, wrapping
   * could strand it at the end of one row while the step it pointed to landed on
   * the next, an orphaned dash with no visible step on either side. Bundling
   * connector+step as one flex item means a wrap can only ever fall BETWEEN
   * complete units, so the connector always stays attached to its step.
   */
  function connectorBefore(index: number): "solid" | "dashed" {
    const prev = PIPELINE_WIZARD_STEPS[index - 1];
    if (!prev) return "dashed";
    if (stepState(prev.id) === "completed" && stepState(PIPELINE_WIZARD_STEPS[index].id) === "completed") {
      return "solid";
    }
    return "dashed";
  }
</script>

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
        {#if i > 0}
          <span
            class="wizard-connector"
            class:wizard-connector-solid={connectorBefore(i) === "solid"}
            class:wizard-connector-dashed={connectorBefore(i) === "dashed"}
            aria-hidden="true"
          ></span>
        {/if}
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
    {/each}
  </ol>
</nav>
