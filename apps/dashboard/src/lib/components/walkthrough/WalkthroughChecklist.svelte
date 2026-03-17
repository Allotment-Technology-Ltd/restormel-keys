<script lang="ts">
  /** Interactive checklist for a phase; persists to localStorage and syncs with WalkthroughStep. */
  import { onMount } from "svelte";
  import { getProgressStore, setStepComplete, syncProgressFromStorage } from "$lib/walkthrough-progress";

  export let phaseSlug = "";
  /** Step id and label for each checklist item */
  export let steps: { id: string; label: string }[] = [];

  const progress = getProgressStore(phaseSlug);
  $: completedCount = steps.filter((s) => $progress[s.id]).length;

  onMount(() => {
    syncProgressFromStorage(phaseSlug);
  });

  function toggle(stepId: string) {
    const next = !$progress[stepId];
    setStepComplete(phaseSlug, stepId, next);
  }
</script>

<div class="walkthrough-checklist">
  <p class="walkthrough-checklist-heading">
    <strong>Checklist</strong>
    {#if completedCount > 0}
      <span class="walkthrough-checklist-count">{completedCount}/{steps.length} done</span>
    {/if}
  </p>
  <ul class="walkthrough-checklist-list" role="list">
    {#each steps as { id, label }}
      {@const done = $progress[id]}
      <li class="walkthrough-checklist-item">
        <label>
          <input type="checkbox" checked={done} on:change={() => toggle(id)} />
          <span class="walkthrough-checklist-label">{label}</span>
        </label>
      </li>
    {/each}
  </ul>
</div>

<style>
  .walkthrough-checklist {
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .walkthrough-checklist-heading {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .walkthrough-checklist-count {
    color: var(--rm-muted);
    font-weight: var(--font-normal);
  }
  .walkthrough-checklist-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .walkthrough-checklist-item {
    margin-bottom: var(--space-2);
  }
  .walkthrough-checklist-item:last-child {
    margin-bottom: 0;
  }
  .walkthrough-checklist-item label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .walkthrough-checklist-item input[type="checkbox"] {
    width: 1.125rem;
    height: 1.125rem;
    accent-color: var(--rm-primary);
  }
  .walkthrough-checklist-label {
    flex: 1;
  }
</style>
