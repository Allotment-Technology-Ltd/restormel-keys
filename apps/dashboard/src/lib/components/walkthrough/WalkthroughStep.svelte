<script lang="ts">
  /** Expandable step section for walkthrough phases. Syncs with WalkthroughChecklist via progress store. */
  import { getProgressStore, setStepComplete } from "$lib/walkthrough-progress";

  export let stepId = "";
  export let title = "";
  export let defaultOpen = false;
  export let phaseSlug = "";

  const progress = getProgressStore(phaseSlug);
  $: completed = $progress[stepId] === true;

  function toggleComplete(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    setStepComplete(phaseSlug, stepId, !completed);
  }
</script>

<details class="walkthrough-step" open={defaultOpen} data-step-id={stepId} data-phase={phaseSlug}>
  <summary class="walkthrough-step-summary">
    <span class="walkthrough-step-title">{title}</span>
    <button
      type="button"
      class="walkthrough-step-check"
      aria-label={completed ? "Mark as incomplete" : "Mark complete"}
      title={completed ? "Mark as incomplete" : "Mark complete"}
      on:click|preventDefault|stopPropagation={toggleComplete}
    >
      {#if completed}
        <span class="check-done" aria-hidden="true">✓</span>
      {:else}
        <span class="check-empty" aria-hidden="true">○</span>
      {/if}
    </button>
  </summary>
  <div class="walkthrough-step-body">
    <slot />
  </div>
</details>

<style>
  .walkthrough-step {
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-3);
    background: var(--rm-surface);
  }
  .walkthrough-step-summary {
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
    font-weight: var(--font-medium);
    user-select: none;
  }
  .walkthrough-step-summary::-webkit-details-marker {
    display: none;
  }
  .walkthrough-step-summary::marker {
    display: none;
  }
  .walkthrough-step-title {
    flex: 1;
  }
  .walkthrough-step-check {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--rm-border);
    border-radius: var(--radius);
    background: var(--rm-bg);
    color: var(--rm-primary);
    font-size: 1rem;
    cursor: pointer;
  }
  .walkthrough-step-check:hover {
    background: var(--rm-surface-raised);
  }
  .check-empty {
    opacity: 0.5;
  }
  .check-done {
    color: var(--rm-success, #22c55e);
  }
  .walkthrough-step-body {
    padding: 0 var(--space-4) var(--space-4);
    margin-top: calc(-1 * var(--space-2));
  }
  .walkthrough-step-body :global(.doc-table),
  .walkthrough-step-body :global(.code-block),
  .walkthrough-step-body :global(.codeblock),
  .walkthrough-step-body :global(.callout),
  .walkthrough-step-body :global(.build-agent-block) {
    margin-left: 0;
    margin-right: 0;
  }
</style>
