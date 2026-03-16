<script lang="ts">
  /**
   * Shared empty-state block: title, description, and one primary recovery action.
   * Use for no projects, no keys, billing not set up, etc. (docs/ux-contracts.md)
   */
  import type { Snippet } from 'svelte';

  export let title: string;
  export let description: string;
  export let children: Snippet;
</script>

<div class="empty-state">
  <h2 class="empty-state-title">{title}</h2>
  <p class="empty-state-desc">{description}</p>
  <div class="empty-state-action">
    {@render children()}
  </div>
</div>

<style>
  .empty-state {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-6);
    margin: 0 0 var(--space-4);
  }
  .empty-state-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .empty-state-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .empty-state-action {
    margin: 0;
  }
</style>
